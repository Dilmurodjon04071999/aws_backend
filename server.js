import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Path to JSON DB files
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database helper functions (Products)
const readProducts = () => {
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading products database file:', err);
    return [];
  }
};

const writeProducts = (products) => {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to products database file:', err);
  }
};

// Database helper functions (Users)
const readUsers = () => {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading users database file:', err);
    return [];
  }
};

const writeUsers = (users) => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to users database file:', err);
  }
};

// Seed databases on startup
const seedDatabases = async () => {
  // 1. Seed Products
  const currentProducts = readProducts();
  if (currentProducts.length === 0) {
    console.log('Database is empty. Fetching initial products from FakeStoreAPI...');
    try {
      const response = await fetch('https://fakestoreapi.com/products');
      if (response.ok) {
        const data = await response.json();
        writeProducts(data);
        console.log(`Successfully seeded database with ${data.length} products!`);
      } else {
        console.error('Failed to fetch from FakeStoreAPI, response status:', response.status);
      }
    } catch (error) {
      console.error('Error seeding products:', error);
    }
  } else {
    console.log(`Database loaded. Found ${currentProducts.length} products.`);
  }

  // 2. Seed Users
  const currentUsers = readUsers();
  if (currentUsers.length === 0) {
    console.log('No users found. Seeding default accounts (admin / user)...');
    const defaultUsers = [
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'user', password: 'user123', role: 'user' }
    ];
    writeUsers(defaultUsers);
    console.log('Default accounts seeded successfully!');
  } else {
    console.log(`Users database loaded. Found ${currentUsers.length} accounts.`);
  }
};

// Seed databases
await seedDatabases();

// --- REST API Routes (Authentication) ---

// 1. POST registration
app.post('/api/auth/register', (req, res) => {
  const users = readUsers();
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Foydalanuvchi nomi, parol va rol kiritilishi shart' });
  }

  if (role !== 'user' && role !== 'admin') {
    return res.status(400).json({ message: 'Noto\'g\'ri rol tanlandi' });
  }

  // Check if user already exists
  const userExists = users.some((u) => u.username.toLowerCase() === username.toLowerCase());
  if (userExists) {
    return res.status(400).json({ message: 'Ushbu foydalanuvchi nomi allaqachon mavjud' });
  }

  const newUser = {
    username,
    password, // Stored as plain text for simplicity in this local mock DB
    role
  };

  users.push(newUser);
  writeUsers(users);

  res.status(201).json({
    message: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz!',
    user: { username, role }
  });
});

// 2. POST login
app.post('/api/auth/login', (req, res) => {
  const users = readUsers();
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Foydalanuvchi nomi va parol kiritilishi shart' });
  }

  const user = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: 'Foydalanuvchi nomi yoki parol noto\'g\'ri' });
  }

  res.json({
    message: 'Tizimga muvaffaqiyatli kirdingiz!',
    user: {
      username: user.username,
      role: user.role
    }
  });
});

// --- REST API Routes (Products CRUD) ---

// 1. GET all products
app.get('/api/products', (req, res) => {
  const products = readProducts();
  res.json(products);
});

// 2. GET single product
app.get('/api/products/:id', (req, res) => {
  const products = readProducts();
  const id = parseInt(req.params.id);
  const product = products.find((p) => p.id === id);
  if (!product) {
    return res.status(404).json({ message: 'Mahsulot topilmadi' });
  }
  res.json(product);
});

// 3. POST new product
app.post('/api/products', (req, res) => {
  const products = readProducts();
  const { title, price, category, image, description, rating } = req.body;

  if (!title || !price || !category || !image || !description) {
    return res.status(400).json({ message: 'Barcha maydonlar to\'ldirilishi shart' });
  }

  const newId = products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1;
  const newProduct = {
    id: newId,
    title,
    price: parseFloat(price),
    category,
    image,
    description,
    rating: rating || { rate: 4.5, count: 10 }
  };

  products.unshift(newProduct);
  writeProducts(products);
  res.status(201).json(newProduct);
});

// 4. PUT update product
app.put('/api/products/:id', (req, res) => {
  const products = readProducts();
  const id = parseInt(req.params.id);
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ message: 'Mahsulot topilmadi' });
  }

  const { title, price, category, image, description, rating } = req.body;
  const updatedProduct = {
    ...products[index],
    title: title !== undefined ? title : products[index].title,
    price: price !== undefined ? parseFloat(price) : products[index].price,
    category: category !== undefined ? category : products[index].category,
    image: image !== undefined ? image : products[index].image,
    description: description !== undefined ? description : products[index].description,
    rating: rating !== undefined ? rating : products[index].rating
  };

  products[index] = updatedProduct;
  writeProducts(products);
  res.json(updatedProduct);
});

// 5. DELETE product
app.delete('/api/products/:id', (req, res) => {
  const products = readProducts();
  const id = parseInt(req.params.id);
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ message: 'Mahsulot topilmadi' });
  }

  products.splice(index, 1);
  writeProducts(products);
  res.json({ message: 'Mahsulot muvaffaqiyatli o\'chirildi' });
});

// Base Route
app.get('/', (req, res) => {
  res.send('LuxeThreads Clothes Store API Server with Auth is Running...');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/products`);
});
