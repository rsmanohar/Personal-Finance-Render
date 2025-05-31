const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Database Setup ---
const db = new Database('finance.db', { verbose: console.log }); // Creates or opens finance.db

// Drop tables if they exist to ensure schema updates during development
db.exec(`DROP TABLE IF EXISTS transactions`);
db.exec(`DROP TABLE IF EXISTS names`);
db.exec(`DROP TABLE IF EXISTS categories`);

// Create names table
db.exec(`
  CREATE TABLE names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_value TEXT NOT NULL UNIQUE
  )
`);

// Create categories table
db.exec(`
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_value TEXT NOT NULL UNIQUE
  )
`);

// Create transactions table with foreign keys
db.exec(`
  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL,
    type TEXT NOT NULL,
    desc TEXT,
    month TEXT NOT NULL,
    FOREIGN KEY (name_id) REFERENCES names(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )
`);

// Enable foreign key support
db.pragma('foreign_keys = ON');

// --- Middleware ---
app.use(express.json()); // For parsing application/json
app.use(express.static(path.join(__dirname))); // Serve static files from the root directory (for HTML, CSS, JS)

// --- API Routes ---

// --- API Routes for Names ---
app.get('/api/names', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM names ORDER BY name_value');
    const names = stmt.all();
    res.json(names);
  } catch (error) {
    console.error('Failed to get names:', error);
    res.status(500).json({ error: 'Failed to retrieve names' });
  }
});

app.post('/api/names', (req, res) => {
  try {
    const { name_value } = req.body;
    if (!name_value || name_value.trim() === '') {
      return res.status(400).json({ error: 'Name value cannot be empty' });
    }
    const stmt = db.prepare('INSERT INTO names (name_value) VALUES (?)');
    const info = stmt.run(name_value.trim());
    res.status(201).json({ id: info.lastInsertRowid, name_value: name_value.trim() });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Name already exists' });
    }
    console.error('Failed to add name:', error);
    res.status(500).json({ error: 'Failed to add name' });
  }
});

// --- API Routes for Categories ---
app.get('/api/categories', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM categories ORDER BY category_value');
    const categories = stmt.all();
    res.json(categories);
  } catch (error) {
    console.error('Failed to get categories:', error);
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { category_value } = req.body;
    if (!category_value || category_value.trim() === '') {
      return res.status(400).json({ error: 'Category value cannot be empty' });
    }
    const stmt = db.prepare('INSERT INTO categories (category_value) VALUES (?)');
    const info = stmt.run(category_value.trim());
    res.status(201).json({ id: info.lastInsertRowid, category_value: category_value.trim() });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Category already exists' });
    }
    console.error('Failed to add category:', error);
    res.status(500).json({ error: 'Failed to add category' });
  }
});


// --- API Routes for Transactions ---

// GET all transactions (with joined names and categories)
app.get('/api/transactions', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT
        t.id, t.date, n.name_value AS name, c.category_value AS category,
        t.amount, t.status, t.type, t.desc, t.month
      FROM transactions t
      JOIN names n ON t.name_id = n.id
      JOIN categories c ON t.category_id = c.id
      ORDER BY t.date DESC, t.id DESC
    `);
    const transactions = stmt.all();
    res.json(transactions);
  } catch (error) {
    console.error('Failed to get transactions:', error);
    res.status(500).json({ error: 'Failed to retrieve transactions' });
  }
});

// POST a new transaction
app.post('/api/transactions', (req, res) => {
  try {
    const { date, name_id, category_id, amount, status, type, desc, month } = req.body;
    // Validate that name_id and category_id are provided and are numbers
    if (!date || typeof name_id !== 'number' || typeof category_id !== 'number' || typeof amount !== 'number' || !status || !type || !month) {
      return res.status(400).json({ error: 'Missing required fields (date, name_id, category_id, amount, status, type, month) or invalid data types' });
    }
    const stmt = db.prepare('INSERT INTO transactions (date, name_id, category_id, amount, status, type, desc, month) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(date, name_id, category_id, amount, status, type, desc, month);
    // For the response, we might want to fetch the newly created transaction with joined names/categories
    // Or simply return the IDs. For now, returning the input body with the new transaction ID.
    res.status(201).json({ id: info.lastInsertRowid, date, name_id, category_id, amount, status, type, desc, month });
  } catch (error) {
    console.error('Failed to add transaction:', error);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

// PUT (update) an existing transaction
app.put('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { date, name_id, category_id, amount, status, type, desc, month } = req.body;
    if (!date || typeof name_id !== 'number' || typeof category_id !== 'number' || typeof amount !== 'number' || !status || !type || !month) {
      return res.status(400).json({ error: 'Missing required fields or invalid data types' });
    }
    const stmt = db.prepare('UPDATE transactions SET date = ?, name_id = ?, category_id = ?, amount = ?, status = ?, type = ?, desc = ?, month = ? WHERE id = ?');
    const info = stmt.run(date, name_id, category_id, amount, status, type, desc, month, id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ id: parseInt(id), date, name_id, category_id, amount, status, type, desc, month });
  } catch (error) {
    console.error('Failed to update transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// DELETE a transaction
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// --- Serve HTML ---
// Serve finance-tracker.html for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'finance-tracker.html'));
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database 'finance.db' initialized/connected.`);
});