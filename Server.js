const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 10000;

// ==========================================
// CONFIGURACIÓN DE CLOUDINARY
// ==========================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper para subir archivos a Cloudinary desde la memoria
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'conexion_moda_antioquia' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url); // Devuelve la URL pública y permanente
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// ==========================================
// CONEXIÓN A MONGODB ATLAS
// ==========================================
const MONGODB_URI = "mongodb+srv://angelby7885_db_user:DuxSgCcJOU9mkfJW@angelby7885.eseusbj.mongodb.net/conexion_moda?retryWrites=true&w=majority&appName=Angelby7885";

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Conexión exitosa a la base de datos MongoDB Atlas'))
  .catch(err => console.error('Error conectando a MongoDB Atlas:', err));

// Definición de Modelos (Mongoose Schemas)
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone: String,
  location: String,
  spec: String,
  garmentTypes: [String],
  roles: [String],
  profileImage: String, // URL permanente de Cloudinary
  providerDetails: {
    capacity: Number,
    minuteValue: Number,
    employeesCount: Number,
    availableMachinery: String
  },
  anclaDetails: {
    requiredVolume: Number,
    productCategory: String
  },
  createdAt: { type: Date, default: Date.now }
});

const interactionSchema = new mongoose.Schema({
  senderId: String,
  targetId: String,
  action: String,
  timestamp: { type: Date, default: Date.now }
});

const appointmentSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  requestedBy: String,
  targetUser: String,
  status: { type: String, default: 'PENDIENTE' },
  scheduleDetails: {
    fecha: String,
    horaInicio: String,
    horaFin: String
  },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Interaction = mongoose.model('Interaction', interactionSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);

// Middlewares esenciales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer en memoria temporal para procesar la imagen antes de enviarla a Cloudinary
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// RUTAS DE AUTENTICACIÓN Y GESTIÓN DE USUARIOS
// ==========================================

app.post('/api/login', async (req, res) => {
  try {
    const emailInput = req.body.email ? req.body.email.toLowerCase().trim() : '';
    const password = req.body.password;

    // 1. Administrador Maestro
    if (emailInput === 'admin@conexionmoda.com' && password === '12345678') {
      const adminUser = {
        id: 'admin',
        name: 'Administrador General',
        email: 'admin@conexionmoda.com',
        roles: ['admin'],
        isAdmin: true,
        spec: 'Gestión y Optimización del Evento'
      };
      return res.json({ message: 'Login de administrador exitoso', user: adminUser });
    }

    // 2. Usuarios en MongoDB Atlas
    const user = await User.findOne({ email: emailInput, password });
    if (!user) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    res.json({ message: 'Login exitoso', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register', upload.single('image'), async (req, res) => {
  try {
    const cleanEmail = req.body.email ? req.body.email.toLowerCase().trim() : '';
    const cleanId = req.body.id ? req.body.id.trim() : '';

    const existing = await User.findOne({ $or: [{ id: cleanId }, { email: cleanEmail }] });
    if (existing) {
      return res.status(400).json({ error: 'El ID o el Correo electrónico ya están registrados.' });
    }

    let garmentTypes = [];
    try { garmentTypes = JSON.parse(req.body.garmentTypes || '[]'); } catch(e) { garmentTypes = [req.body.garmentTypes]; }

    let roles = [];
    try { roles = JSON.parse(req.body.roles || '[]'); } catch(e) { roles = [req.body.roles]; }

    let providerDetails = null;
    if (req.body.providerDetails) { try { providerDetails = JSON.parse(req.body.providerDetails); } catch(e) {} }

    let anclaDetails = null;
    if (req.body.anclaDetails) { try { anclaDetails = JSON.parse(req.body.anclaDetails); } catch(e) {} }

    // Subir imagen a Cloudinary y obtener su URL segura
    let profileImage = null;
    if (req.file) {
      profileImage = await uploadToCloudinary(req.file.buffer);
    }

    const newUser = new User({
      id: cleanId,
      name: req.body.name,
      email: cleanEmail,
      password: req.body.password,
      phone: req.body.phone,
      location: req.body.location,
      spec: req.body.spec,
      garmentTypes,
      roles,
      profileImage,
      providerDetails,
      anclaDetails
    });

    await newUser.save();
    res.json({ message: 'Registro de empresa exitoso', user: newUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/update-profile', upload.single('image'), async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      phone: req.body.phone,
      location: req.body.location,
      spec: req.body.spec
    };

    if (req.file) {
      updateData.profileImage = await uploadToCloudinary(req.file.buffer);
    }

    const updatedUser = await User.findOneAndUpdate({ id: req.body.id }, updateData, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Perfil actualizado correctamente', user: updatedUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// RUTAS DE EXPLORACIÓN Y SWIPES (MATCHMAKING)
// ==========================================

app.get('/api/profiles/:id', async (req, res) => {
  try {
    const currentUserId = req.params.id;
    const currentUser = await User.findOne({ id: currentUserId });
    if (!currentUser) {
      return res.status(404).json({ error: 'Usuario actual no encontrado' });
    }

    const interactions = await Interaction.find({ senderId: currentUserId });
    const interactedIds = interactions.map(i => i.targetId);

    let query = { 
      id: { $ne: currentUserId, $nin: interactedIds }, 
      email: { $ne: 'admin@conexionmoda.com' } 
    };

    if (currentUser.roles.includes('ancla') && !currentUser.roles.includes('provider')) {
      query.roles = 'provider';
    } else if (currentUser.roles.includes('provider') && !currentUser.roles.includes('ancla')) {
      query.roles = 'ancla';
    }

    const profilesToShow = await User.find(query);
    res.json(profilesToShow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/swipe', async (req, res) => {
  try {
    const { senderId, targetId, action } = req.body;
    await Interaction.create({ senderId, targetId, action });

    // Cada Like genera una cita de inmediato (unilateral)
    if (action === 'like') {
      const existingApp = await Appointment.findOne({
        $or: [
          { requestedBy: senderId, targetUser: targetId },
          { requestedBy: targetId, targetUser: senderId }
        ]
      });

      if (!existingApp) {
        await Appointment.create({
          id: `match_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          requestedBy: senderId,
          targetUser: targetId,
          status: 'PENDIENTE'
        });
      }
      return res.json({ message: '¡Interés registrado y Cita Generada!', match: true });
    }

    res.json({ message: 'Swipe registrado correctamente', match: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/matches/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const userAppointments = await Appointment.find({ $or: [{ requestedBy: userId }, { targetUser: userId }] });
    const users = await User.find({});

    const matchesData = userAppointments.map(app => {
      const partnerId = app.requestedBy === userId ? app.targetUser : app.requestedBy;
      const partner = users.find(u => u.id === partnerId) || { name: 'Empresa', spec: 'N/A' };
      
      return {
        appointmentId: app.id,
        appointmentStatus: app.status,
        scheduleDetails: app.scheduleDetails || null,
        ...partner.toObject()
      };
    });

    res.json(matchesData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// RUTAS DE ADMINISTRACIÓN Y MOTOR DE CITAS
// ==========================================

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const users = await User.find({});
    const interactions = await Interaction.find({});
    const rawAppointments = await Appointment.find({});

    // Traducir IDs a Nombres comerciales en las citas del Admin
    const appointments = rawAppointments.map(app => {
      const appObj = app.toObject();
      const reqUser = users.find(u => u.id === appObj.requestedBy);
      const targetUser = users.find(u => u.id === appObj.targetUser);

      appObj.requestedBy = reqUser ? reqUser.name : appObj.requestedBy;
      appObj.targetUser = targetUser ? targetUser.name : appObj.targetUser;
      return appObj;
    });

    res.json({
      totalUsers: users.length,
      totalInteractions: interactions.length,
      totalAppointments: appointments.length,
      users,
      interactions,
      appointments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/optimize-calendar', async (req, res) => {
  try {
    const { startTime, endTime, durationMinutes } = req.body;
    const appointments = await Appointment.find({});

    if (!appointments || appointments.length === 0) {
      return res.status(400).json({ error: 'No hay citas o matches pendientes para optimizar.' });
    }

    const duration = parseInt(durationMinutes) || 6; 
    const startParts = (startTime || '08:00').split(':');
    const endParts = (endTime || '17:00').split(':');

    let currentSlotTime = new Date();
    currentSlotTime.setHours(parseInt(startParts[0]), parseInt(startParts[1]), 0, 0);

    const endLimit = new Date();
    endLimit.setHours(parseInt(endParts[0]), parseInt(endParts[1]), 0, 0);

    const userBusyTimes = {};

    for (let app of appointments) {
      let slotAssigned = false;
      let slotTimeIter = new Date(currentSlotTime);

      while (slotTimeIter < endLimit && !slotAssigned) {
        const timeStr = slotTimeIter.toTimeString().substring(0, 5);
        const user1 = app.requestedBy;
        const user2 = app.targetUser;

        if (!userBusyTimes[user1]) userBusyTimes[user1] = [];
        if (!userBusyTimes[user2]) userBusyTimes[user2] = [];

        if (!userBusyTimes[user1].includes(timeStr) && !userBusyTimes[user2].includes(timeStr)) {
          userBusyTimes[user1].push(timeStr);
          userBusyTimes[user2].push(timeStr);

          const slotEndIter = new Date(slotTimeIter.getTime() + duration * 60000);
          const endTimeStr = slotEndIter.toTimeString().substring(0, 5);

          app.status = 'PROGRAMADO_POR_IA';
          app.scheduleDetails = {
            fecha: new Date().toLocaleDateString('es-CO'),
            horaInicio: timeStr,
            horaFin: endTimeStr
          };
          await app.save();
          slotAssigned = true;
        }

        slotTimeIter = new Date(slotTimeIter.getTime() + duration * 60000);
      }
    }

    res.json({ message: '¡Calendario optimizado con éxito mediante algoritmo matemático!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// RUTAS DE NAVEGACIÓN FRONT-END (HTML)
// ==========================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/matches', (req, res) => res.sendFile(path.join(__dirname, 'public', 'matches.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor B2B Conexión Moda Antioquia corriendo en el puerto ${PORT}`);
});
