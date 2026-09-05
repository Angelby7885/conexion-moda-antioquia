// models/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: [true, 'El ID de usuario es obligatorio.'], 
    unique: true,
    trim: true 
  },
  name: { 
    type: String, 
    required: [true, 'El nombre o empresa es obligatorio.'],
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, 'El correo electrónico es obligatorio.'], 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria.']
  },
  phone: {
    type: String,
    required: [true, 'El número de celular es obligatorio.'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'La ubicación o municipio es obligatoria.'],
    trim: true
  },
  spec: { 
    type: String, 
    required: [true, 'La especialidad del sector es obligatoria.'],
    trim: true 
  },
  garmentTypes: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'Debe seleccionar al menos un tipo de prenda.'
    }
  },
  roles: {
    type: [String],
    required: true,
    enum: ['provider', 'ancla', 'administrador']
  },
  profileImage: {
    type: String,
    default: ''
  },
  providerDetails: {
    capacity: { type: Number },
    minuteValue: { type: Number },
    employeesCount: { type: Number },
    availableMachinery: { type: String, trim: true }
  },
  anclaDetails: {
    requiredVolume: { type: Number },
    productCategory: { type: String, trim: true }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const User = mongoose.model('User', userSchema);
module.exports = User;