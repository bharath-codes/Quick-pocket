// server.js - FINAL GUARANTEED VERSION WITH REGISTRATION FIX

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;

// --- CONFIGURATION ---
const JWT_SECRET = 'your-super-secret-jwt-key-that-is-long-and-secure';
const ADMIN_EMAIL = 'admin@quickpocket.com';
const ADMIN_PASSWORD = 'SecurePass123!';
const dbConfig = {
    user: 'postgres',
    host: 'localhost',
    database: 'quickpocket_db',
    password: 'Bharathsql', // Your PostgreSQL password
    connectionString: process.env.DATABASE_URL,
    // **** ADD THIS LINE ****
    ssl: true,
};
    port: 5432,
};

// --- INITIALIZATION ---
const pool = new Pool(dbConfig);
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- MULTER CONFIG ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + path.extname(file.originalname);
        cb(null, `${req.user.userId}-${file.fieldname}-${uniqueSuffix}`);
    }
});
const upload = multer({ storage: storage });

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};
const authenticateAdmin = (req, res, next) => { if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required.' }); next(); };

// --- API ENDPOINTS ---

// ** THIS IS THE CORRECTED REGISTRATION ENDPOINT **
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, phoneNumber, password } = req.body; // FIX: Now accepts 'name'
        if (!name || !phoneNumber || !password) return res.status(400).json({ message: 'All fields are required.' });
        
        const existingUser = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
        if (existingUser.rows.length > 0) return res.status(400).json({ message: 'Phone number already registered.' });
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        // FIX: Now inserts 'name' into the database
        await pool.query('INSERT INTO users (name, phone_number, password_hash) VALUES ($1, $2, $3)', [name, phoneNumber, passwordHash]);
        
        res.status(201).json({ message: 'Registration successful! Please log in.' });
    } catch (error) { 
        console.error('Reg Error:', error); 
        res.status(500).json({ message: 'Server error during registration.' }); 
    }
});

// Login (No changes needed)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (identifier.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            if (password === ADMIN_PASSWORD) {
                const token = jwt.sign({ name: 'Admin', isAdmin: true }, JWT_SECRET, { expiresIn: '8h' });
                return res.json({ message: 'Admin login successful!', token });
            }
            return res.status(401).json({ message: 'Invalid admin credentials.' });
        }
        const userResult = await pool.query('SELECT * FROM users WHERE phone_number = $1', [identifier]);
        const user = userResult.rows[0];
        if (!user) return res.status(401).json({ message: 'Invalid credentials.' });
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) return res.status(401).json({ message: 'Invalid credentials.' });
        const token = jwt.sign({ userId: user.id, phoneNumber: user.phone_number, name: user.name, isAdmin: false }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login successful!', token });
    } catch (error) { console.error('Login Error:', error); res.status(500).json({ message: 'Server error.' }); }
});

// User Dashboard (No changes needed)
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    if (req.user.isAdmin) return res.status(403).json({ message: "Not a user token." });
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
        const appResult = await pool.query("SELECT * FROM applications WHERE user_id = $1 AND status NOT IN ('Paid', 'Acknowledged Rejection') ORDER BY date DESC LIMIT 1", [req.user.userId]);
        res.json({ user: userResult.rows[0], application: appResult.rows[0] || null });
    } catch (error) { console.error('Dashboard Error:', error); res.status(500).json({ message: 'Server error fetching dashboard.' }); }
});

// User Loan Application (No changes needed)
app.post('/api/apply', authenticateToken, upload.fields([{ name: 'selfie', maxCount: 1 }, { name: 'aadhar', maxCount: 1 }, { name: 'pan', maxCount: 1 }]), async (req, res) => {
    try {
        const { amount, tenure, name, altPhoneNumber } = req.body;
        const files = req.files;
        if (!amount || !tenure || !name || !altPhoneNumber || !files.selfie || !files.aadhar || !files.pan) return res.status(400).json({ message: 'All fields and files are required.' });
        const selfieUrl = `${req.protocol}://${req.get('host')}/uploads/${files.selfie[0].filename}`;
        const aadharUrl = `${req.protocol}://${req.get('host')}/uploads/${files.aadhar[0].filename}`;
        const panUrl = `${req.protocol}://${req.get('host')}/uploads/${files.pan[0].filename}`;
        await pool.query( 'UPDATE users SET name = $1, alt_phone_number = $2, selfie_url = $3, aadhar_url = $4, pan_url = $5 WHERE id = $6', [name, altPhoneNumber, selfieUrl, aadharUrl, panUrl, req.user.userId] );
        const interestRate = 20.00;
        const repaymentAmount = parseFloat(amount) * (1 + (interestRate / 100));
        await pool.query( 'INSERT INTO applications (user_id, amount, status, interest_rate, tenure_weeks, repayment_amount) VALUES ($1, $2, $3, $4, $5, $6)', [req.user.userId, amount, 'Pending', interestRate, tenure, repaymentAmount] );
        res.status(201).json({ message: 'Application and documents submitted successfully!' });
    } catch (error) { console.error('Apply Error:', error); res.status(500).json({ message: 'Server error during application submission.' }); }
});

// Admin Dashboard Data (No changes needed)
app.get('/api/admin/applications', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const query = `SELECT app.*, u.name as user_name, u.phone_number as user_phone, u.alt_phone_number, u.selfie_url, u.aadhar_url, u.pan_url FROM applications app JOIN users u ON app.user_id = u.id ORDER BY app.date DESC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) { console.error('Admin Fetch Error:', error); res.status(500).json({ message: 'Server error fetching applications.' }); }
});

// Admin Status Update (No changes needed)
app.put('/api/admin/applications/update-status', authenticateToken, authenticateAdmin, async (req, res) => {
    const { applicationId, newStatus } = req.body;
    if (!applicationId || !newStatus) return res.status(400).json({ message: 'Application ID and new status are required.' });
    const allowedStatuses = ['Approved', 'Rejected', 'Disbursed'];
    if (!allowedStatuses.includes(newStatus)) return res.status(400).json({ message: 'Invalid status update.' });
    try {
        const result = await pool.query("UPDATE applications SET status = $1 WHERE id = $2 RETURNING *", [newStatus, applicationId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Application not found.' });
        res.json({ message: 'Status updated successfully!', application: result.rows[0] });
    } catch (error) { console.error('Admin Update Error:', error); res.status(500).json({ message: 'Server error updating status.' }); }
});

// --- SERVER START ---
async function startServer() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection established.');
    client.release();
    app.listen(PORT, () => console.log(`🚀 Quick Pocket server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ FATAL: COULD NOT CONNECT TO DATABASE!', err.message);
    process.exit(1);
  }
}
startServer();