import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 640,
    resizable: false,
    roundedCorners: true,
    title: "virex Voice",
    backgroundColor: "#0b1020",
    webPreferences: { nodeIntegration: false },
  });

  // لما يشتغل، يفتح الواجهة من Vite
  win.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
