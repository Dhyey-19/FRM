const { app, BrowserWindow } = require('electron');
const path = require('path');

// Suppress harmless Chromium DevTools warnings in the console (like Autofill.enable failed)
app.commandLine.appendSwitch('log-level', '3');

// Start the backend server
const { startServer } = require('../backend/server.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.png') // Optional icon
  });

  if (process.env.NODE_ENV === 'development') {
    // In dev, load from the Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.maximize();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Start backend before window is created (only in production)
  // In development, Nodemon handles the backend for hot-reloading.
  if (process.env.NODE_ENV !== 'development') {
    try {
      await startServer();
      console.log('Backend started successfully');
    } catch (err) {
      console.error('Failed to start backend:', err);
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
