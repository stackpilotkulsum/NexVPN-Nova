# ⬡ NEXVPN — Quick Start

## ✅ Step 1: Start Backend

```powershell
cd backend
npm install
node server.js
```

You should see:
```
✅ NEXVPN Backend running!
   → API:    http://localhost:3001/api
   → Socket: http://localhost:3001
```

### ❌ If you get "address already in use":
```powershell
# Find the PID using port 3001
netstat -ano | findstr :3001

# Kill it (replace 12345 with actual PID)
taskkill /PID 12345 /F

# Then run again
node server.js
```

## ✅ Step 2: Start Frontend

Open a **new terminal**:
```powershell
cd frontend
npm install
npm start
```

Browser opens at **http://localhost:3000**

## Features
- ⬡ **Overview** — Privacy score (0–100) with animated ring
- 🌐 **Servers** — Click any card to connect; real TCP latency shown
- 🔒 **Protocol** — Click any card to switch protocol
- 🛡️ **Security** — Kill switch, DNS protection, split tunneling
- ☠️ **Threats** — Live threat feed + domain scanner
- 🔍 **Leak Tests** — Real WebRTC + DNS leak detection
- 🗺️ **GeoSpoof** — Live animated world map showing real vs masked location
- ⚡ **Speed** — Real download speed test via Cloudflare CDN
- 📡 **Network** — Live TCP latency to all servers
