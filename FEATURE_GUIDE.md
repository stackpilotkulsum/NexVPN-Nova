# VPN Simulation System - Complete Feature Guide

## 🎯 How to Use All Features

### Prerequisites
- Both servers running (Backend port 3001, Frontend port 3000)
- Open http://localhost:3000 in browser
- Register 2 accounts in 2 different windows (use incognito mode for second account)

---

## 📡 TAB 1: VPN Status (Connection Details)

### What It Shows:
- Your connection ID (unique identifier)
- Current latency (ms)
- Packet loss percentage
- Connection uptime
- Encryption protocol details

### How to Use:
1. **Click** "📡 VPN Status" tab
2. **Simulate Latency**:
   - Move the latency slider left/right (0-500ms)
   - This simulates network delay
   - Messages will take longer to arrive
   
3. **Simulate Packet Loss**:
   - Move the packet loss slider left/right (0-100%)
   - This simulates lost packets (0-20% loss)
   - Some messages might fail to deliver

4. **View Encryption Info**:
   - See TLS 1.3, RSA-OAEP, AES-256-CBC details
   - Green "Secured" badge shows connection is protected

### Example:
```
Set latency to 200ms
Set packet loss to 10%
Then send chat messages
Messages will take 200ms to arrive + some might be dropped
```

---

## 💬 TAB 2: Secure Chat (Real-Time Messaging)

### What It Shows:
- List of online users on the left
- Chat messages in the middle
- Message input at the bottom
- 🔐 badge shows encrypted/secured messages

### How to Use:
1. **Click** "💬 Secure Chat" tab
2. **See Online Users**:
   - Lists all users connected (excluding yourself)
   - Shows user count: "👥 Online Users (1)"

3. **Select a User**:
   - Click on any username in the left sidebar
   - They'll be highlighted in blue

4. **Send a Message**:
   - Type your message in the text box at bottom
   - Click **"Send 🔐"** button
   - Message appears instantly in your chat
   - Also appears in recipient's window

5. **Receive Messages**:
   - When someone sends you a message
   - It appears automatically in the chat
   - Shows sender name, message, and latency

### Step-by-Step Chat Test:
```
WINDOW 1 (Alice):
1. Register: alice / alice@test.com / password123
2. Click "Secure Chat"
3. Wait for Bob to appear in user list

WINDOW 2 (Bob):
1. Register: bob / bob@test.com / password123
2. Click "Secure Chat"
3. Wait for Alice to appear in user list

WINDOW 1 (Alice):
1. Click on "bob" in user list
2. Type "Hello Bob! 👋"
3. Click "Send 🔐"

WINDOW 2 (Bob):
1. Should see Alice's message immediately
2. Alice's name shows as sender
3. Message appears with timestamp

WINDOW 2 (Bob):
1. Click on "alice" in user list
2. Type "Hi Alice! 😊"
3. Click "Send 🔐"

WINDOW 1 (Alice):
1. Should see Bob's reply
2. Conversation continues...
```

---

## 📊 TAB 3: Network Monitor (Traffic Statistics)

### What It Shows:
- **Data Sent**: Bytes uploaded by this user
- **Data Received**: Bytes downloaded by this user
- **Total Traffic**: Sum of sent + received
- **Session Uptime**: How long connected
- **Traffic Analysis**: Upload/download speeds
- **Traffic Breakdown**: Pie chart of upload vs download
- **Security Status**: Encryption verification

### How to Use:
1. **Click** "📊 Network Monitor" tab
2. **View Statistics**:
   - Card 1: Shows data uploaded
   - Card 2: Shows data downloaded
   - Card 3: Shows total bandwidth
   - Card 4: Shows connection duration

3. **Generate Traffic**:
   - Go to "💬 Secure Chat" tab
   - Send multiple messages back and forth
   - Each message counts as data sent/received

4. **Watch Stats Update**:
   - Go back to "📊 Network Monitor"
   - Stats refresh every 2 seconds
   - You'll see bytes and packet counts increase

5. **Traffic Analysis Section**:
   - Shows average upload speed (B/s)
   - Shows average download speed (B/s)
   - Shows total packets sent/received
   - Data: bytes / uptime in seconds = speed

6. **Traffic Breakdown**:
   - Blue bar = Upload percentage
   - Purple bar = Download percentage
   - Shows upload/download split

### Example:
```
BEFORE CHATTING:
- Data Sent: 0 B
- Data Received: 0 B
- Total Traffic: 0 B
- Uptime: 0s

AFTER SENDING 5 MESSAGES (~150 bytes each):
- Data Sent: 750 B (5 messages)
- Data Received: 750 B (5 replies)
- Total Traffic: 1.5 KB
- Uptime: 30s
- Average Speed: 25 B/s
- Security: All ✓ green

AFTER SENDING 20 MESSAGES:
- Data Sent: 3 KB
- Data Received: 3 KB
- Total Traffic: 6 KB
- Uptime: 2m
- Average Speed: 50 B/s
```

---

## 🔀 Complete User Journey

### Step 1: Setup (5 minutes)
```
Window 1: http://localhost:3000 → Register Alice
Window 2: http://localhost:3000 (Incognito) → Register Bob
```

### Step 2: Test VPN Status (5 minutes)
```
Window 1 (Alice):
- Click "VPN Status"
- Set Latency = 100ms
- Set Packet Loss = 5%
- Note your Connection ID
```

### Step 3: Test Chat (10 minutes)
```
Window 1 (Alice):
1. Click "Secure Chat"
2. See "bob" in user list
3. Click on bob
4. Type "Hello Bob! Testing chat now 👋"
5. Click "Send 🔐"

Window 2 (Bob):
1. Should see Alice's message immediately
2. See message with 100ms latency indicator
3. Reply: "Hi Alice! Got your message! 😊"

Window 1 (Alice):
1. See Bob's reply
2. Message count increases in Network Monitor
```

### Step 4: Monitor Traffic (5 minutes)
```
After chatting 20+ messages:

Window 1 (Alice):
- Click "Network Monitor"
- See Data Sent: ~5 KB
- See Data Received: ~5 KB
- See uptime: 5 minutes
- See speeds calculated
- All security checks: ✓

Window 2 (Bob):
- Click "Network Monitor"
- Same stats should appear
- Your traffic matches Alice's
```

---

## 🎮 Advanced Testing

### Test 1: High Latency Simulation
```
1. VPN Status tab
2. Set Latency to 500ms (very high)
3. Go to Chat
4. Send message: "Testing 500ms latency"
5. Watch it take 0.5 seconds to deliver
6. Message shows "500ms" in Network Monitor
```

### Test 2: Packet Loss Simulation
```
1. VPN Status tab
2. Set Packet Loss to 50%
3. Go to Chat
4. Send 10 messages quickly
5. Some might fail (packet loss)
6. Watch Network Monitor - some messages won't count
```

### Test 3: Multiple Conversations
```
1. Open 3 browser windows (Alice, Bob, Charlie)
2. All register and chat
3. Alice chats with Bob
4. Alice also chats with Charlie
5. Bob chats with Charlie
6. Network Monitor shows combined traffic
```

### Test 4: Encryption Verification
```
1. Any tab - see Security Status
2. All 4 checkmarks should be green:
   ✓ AES-256-CBC Encryption Active
   ✓ RSA Key Exchange Completed
   ✓ JWT Authentication Verified
   ✓ Secure Channel Established
```

---

## 📈 Understanding the Stats

### Data Sent: 3.2 KB
- Total bytes uploaded (messages you sent)
- Each text message = ~50-200 bytes depending on length

### Data Received: 2.8 KB
- Total bytes downloaded (messages you received)
- Usually similar to Data Sent in equal conversations

### Total Traffic: 6 KB
- Sum of all data (sent + received)
- Shows total bandwidth usage

### Session Uptime: 5min 30s
- How long you've been connected
- Starts from login

### Average Upload Speed: 100 B/s
- Calculated as: Total Bytes Sent ÷ Uptime in seconds
- Higher = faster connection

### Packet Count
- Packets Sent: Number of messages sent
- Packets Received: Number of messages received
- 1 message = 1 packet

---

## 🔐 Security Indicators

All these should show ✓ (green check):

1. **AES-256-CBC Encryption Active**
   - Means messages are encrypted
   - 256-bit key = maximum security

2. **RSA Key Exchange Completed**
   - Means key negotiation happened
   - 2048-bit RSA = strong encryption

3. **JWT Authentication Verified**
   - Means you're properly logged in
   - Token proved your identity

4. **Secure Channel Established**
   - Means connection is protected
   - All actions are secure

---

## ⚠️ Troubleshooting

### No users appearing in chat?
- Refresh page (F5)
- Make sure both windows have different accounts
- Both must be on "Secure Chat" tab

### Messages not sending?
- Check packet loss - might be dropping them
- Verify recipient is online (in user list)
- Wait a few seconds (latency simulation)

### No traffic showing in Network Monitor?
- Send some chat messages first
- Stats refresh every 2 seconds
- Check you're looking at YOUR stats

### Security Status showing red?
- Should never happen
- If it does, refresh page
- Check backend is running

---

## 🎯 Quick Start Checklist

- [ ] Both servers running
- [ ] Opened http://localhost:3000
- [ ] Registered 2 accounts
- [ ] Viewed VPN Status tab
- [ ] Set latency/packet loss sliders
- [ ] Sent chat message to another user
- [ ] Received reply in chat
- [ ] Checked Network Monitor stats
- [ ] Verified all security indicators green
- [ ] See traffic stats increase with messages

---

Done! You now have a fully functional VPN simulation system! 🎉
