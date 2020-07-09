const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const mongoose = require('mongoose')
const config = require('config')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const auth = require('../assignment_backend/middleware/auth')
const { check, validationResult } = require('express-validator')
mongoose.Promise = global.Promise
mongoose.connect(config.get('mongo.url'),{
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useCreateIndex: true
})

const { Schema } = mongoose
const { ObjectId } = mongoose.Types;
ObjectId.prototype.valueOf = function () {
	return this.toString()
}

const User = mongoose.model('User', new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  firstname: {
    type: String,
    required: true
  },
  lastname: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'user'
  }
}))

const Transaction = mongoose.model('Transaction', new Schema({
  user: { type: ObjectId, ref: 'User' },
  amount: Number,
  type: String, // income, expense
  remark: {
    type: String,
    default: '-'
  },
  date: Date,
  // balance: Number,
}))

const app = express()

app.use(cors())
app.use(bodyParser.json())

app.get('/', (req, res) => res.send('hello'))

app.get('/users', auth,(req, res) => {
  try{
    User.findById(req.user.id).select('-password')
    .then((data) => {
      res.send(data)
    })
  }
  catch(err){
    console.error(err);
    res.status(500).send('Server error')
  }
})

app.post('/users/login', [
  check('username', 'Username is Required'),
  check(
    'password', 
    'Password is required'
  ).exists()
    .not()
    .isEmpty()] ,
 async (req, res) => { 
      const errors = validationResult(req);
      if(!errors.isEmpty()){
        return res.status(400).json({ errors: errors.array() });
      }
      const { username, password } = req.body;
      try{
        let user = await User.findOne({ username });
        if(!user){
          return res.status(400).json({ errors: [{ msg: 'Invalid Credentials'}] });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
          return res.status(400).json({ errors: [{ msg: 'Invalid Credentials'}] });
        }
        const payload = {
          user: { 
            id: user.id,
            role: user.role
          }
        };
        jwt.sign(
          payload, 
          config.get('mongo.jwtSecret'),
          { expiresIn: 86400 }, 
          (err, token) => {
            if(err) {
              console.error(err);
            }
            else{
              res.json({ token });
            }
          }
        );
      }
      catch(err){
        console.error(err.messasge);
        res.status(500).send('Server error');
      }
})

app.post('/users', [
  check('firstname', 'FisrtName is required')
    .not()
    .isEmpty(),
  check('lastname', 'LastName is required')
    .not()
    .isEmpty(),
  check(
    'password', 
    'Please enter a password with 6 or more characters'
  ).isLength({ min:6 }),
  check('username', 'Username is Required')
    .not()
    .isEmpty()] ,
async (req, res) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()){
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, firstname, lastname } = req.body;
  try{
    let user = await User.findOne({ username });
    if(user){
      return res.status(400).json({ errors: [{ msg: 'User already exists'}] });
    }

    user = new User({
      username,
      password,
      firstname,
      lastname
    });
    const salt  = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    const payload = {
      user: { 
        id: user.id
      }
    };
    jwt.sign(
      payload, 
      config.get('mongo.jwtSecret'),
      { expiresIn: 360000 }, 
      (err, token) => {
        if(err) {
          console.error(err);
        }
        else{
          res.json({ token });
        }
      }
    );
  }
  catch(err){
    console.error(err.messasge);
    res.status(500).send('Server error');
  }
  
});

app.get('/transactions', (req, res) => {
  const date1 = Date(req.query.date1)
  const date2 = Date(req.query.date2)
  if(req.query.type === '' && req.query.date1 !== req.query.date2){
    Transaction.find({date: { $gte: date1 ,$lt: date2 }})
      .then((data) => { res.send(data) })
  }
  else if(req.query.type !== '' && req.query.date1 !== req.query.date2){
    Transaction.find({type: req.query.type },{date: { $gte: date1 ,$lt: date2 }})
      .then((data) => { res.send(data) })
  }
  else if(req.query.type !== '' && req.query.date1 === req.query.date2){
    Transaction.find({ type: req.query.type },{ date: date2 })
      .then((data) => { res.send(data) })
  }
  else{
    Transaction.find({ date: date2 })
      .then((data) => { res.send(data) })
  }
})

app.post('/transactions', (req, res) => {
  Transaction.create(req.body)
    .then((data) => {
      res.send(data)
    })
})

app.put('/transactions/:id', (req, res) => {
  Transaction.findOneAndUpdate({ _id: req.params.id }, req.body)
    .then((data) => {
      res.send(data)
    })
})

app.delete('/transactions/:id', (req, res) => {
  Transaction.findOneAndRemove({ _id: req.params.id })
    .then((data) => {
      res.send(data)
    })
})

app.listen(8080, () => {
  console.log('listen on port 8080')
})
