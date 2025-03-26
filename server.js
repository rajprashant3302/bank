require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(__dirname, "users.json");

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// ✅ Load Users from File
function loadUsers() {
    try {
        let users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
        // console.log("Users loaded successfully:", users); // ✅ Debugging
        return users;
    } catch (error) {
        // console.error("Error loading users.json:", error); // ✅ Debugging
        return {};
    }
}


// ✅ Save Users to File
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

// ✅ Handle User Login
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    let users = loadUsers(); // Load users from file

    // console.log("Loaded Users:", users); // ✅ Debugging
    console.log("Received Username:", username);
    
    if (!username || !password) {
        return res.json({ success: false, message: "Username and password are required!" });
    }

    if (!users[username]) {
        // console.log("User not found:", username); // ✅ Debugging
        return res.json({ 
            success: false, 
            message: "User not found. Redirecting to account creation.", 
            redirect: "code3.html"
        });
    }

    if (users[username].password !== password) {
        // console.log("Incorrect password for:", username); // ✅ Debugging
        return res.json({ success: false, message: "Incorrect password! Please try again." });
    }

    // console.log("Login successful for:", username); // ✅ Debugging

    res.json({
        success: true,
        message: `Welcome, ${users[username].name}!`,
        redirect: "code4.html",
        name: users[username].name,
        username: username,
        balance: users[username].balance,
        transactions: users[username].transactions
    });
});

// ✅ Handle Card Details Fetching
app.post("/get-card-details", (req, res) => {
    const { username, password } = req.body;
    let users = loadUsers();

    // console.log("Checking card details for:", username); // Debugging

    if (!users[username]) {
        console.log("User not found:", username);
        return res.status(400).json({ success: false, message: "User not found!" });
    }

    if (users[username].password !== password) {
        console.log("Incorrect password for:", username);
        return res.status(400).json({ success: false, message: "Incorrect password!" });
    }

    const { name, cardNumber } = users[username];
    const expiry = "12/28"; // Change as needed

    console.log("Card details sent for:", username);
    res.json({ success: true, name, cardNumber, expiry });
});



// ✅ Generate Unique Numbers (Account 15-digit, Card 16-digit)
function generateUniqueNumber(length) {
    return Math.floor(Math.pow(10, length - 1) + Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1))).toString();
}

// ✅ Nodemailer Setup (Email OTP)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ✅ OTP Store Object
const OTP_STORE = {};

// ✅ Generate OTP Function
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ✅ Send OTP via Email
async function sendOTPviaEmail(email, otp) {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your Infinity Bank OTP",
            text: `Your Infinity Bank OTP is: ${otp}. Do not share this with anyone.`
        });
        console.log(`✅ OTP sent successfully to ${email}`);
        return true;
    } catch (error) {
        console.error("❌ Error sending OTP via email:", error);
        return false;
    }
}

// ✅ Handle OTP Request
app.post("/request-otp", async (req, res) => {
    const { username } = req.body;
    let users = loadUsers();

    if (!users[username]) {
        return res.status(400).json({ success: false, message: "User not found!" });
    }

    const otp = generateOTP();
    OTP_STORE[username] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    const sent = await sendOTPviaEmail(users[username].email, otp);
    res.json({ success: sent, message: sent ? "OTP sent to your email!" : "Failed to send OTP!" });
});

// ✅ Handle Transactions (Deposit & Withdraw)
app.post("/transaction", (req, res) => {
    const { username, type, amount, otp } = req.body;
    let users = loadUsers();

    if (!users[username] || !OTP_STORE[username] || OTP_STORE[username].otp !== otp || OTP_STORE[username].expires < Date.now()) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP!" });
    }

    let balance = users[username].balance || 0;
    let transactions = users[username].transactions || [];

    if (type === "deposit") {
        balance += amount;
        transactions.push(`${new Date().toLocaleString()} - Deposited ₹${amount}`);
    } else if (type === "withdraw") {
        if (balance < amount) return res.status(400).json({ success: false, message: "Insufficient balance!" });
        balance -= amount;
        transactions.push(`${new Date().toLocaleString()} - Withdrew ₹${amount}`);
    } else {
        return res.status(400).json({ success: false, message: "Invalid transaction type!" });
    }

    users[username].balance = balance;
    users[username].transactions = transactions;
    saveUsers(users);

    delete OTP_STORE[username];

    res.json({ success: true, message: `Transaction successful!`, balance, transactions });
});

// ✅ Fetch User Transactions
app.get("/transactions", (req, res) => {
    const username = req.query.username;
    let users = loadUsers();

    if (!users[username]) {
        return res.status(400).json({ success: false, message: "User not found!" });
    }

    res.json({ success: true, transactions: users[username].transactions, balance: users[username].balance });
});

// ✅ Handle User Registration
app.post("/register", (req, res) => {
    const { username, name, dob, aadhaar, phone, email, address, password } = req.body;
    let users = loadUsers();

    if (users[username]) return res.json({ success: false, message: "Username already exists!" });

    const accountNumber = generateUniqueNumber(15);
    const cardNumber = generateUniqueNumber(16);

    users[username] = {
        name, dob, aadhaar, phone, email, address, password, accountNumber, cardNumber, balance: 0, transactions: []
    };

    saveUsers(users);

    res.json({ success: true, message: "Account created successfully!", accountNumber, cardNumber });
});
// ✅ Verify Password to Show Full Account Number
app.post("/verify-password", (req, res) => {
    const { username, password } = req.body;
    let users = loadUsers();

    if (!users[username]) {
        return res.status(400).json({ success: false, message: "User not found!" });
    }

    if (users[username].password !== password) {
        return res.status(400).json({ success: false, message: "Incorrect password!" });
    }

    res.json({ success: true, accountNumber: users[username].accountNumber });
});


// ✅ Fetch User Details for view-card.html
app.get("/getUserDetails", (req, res) => {
    const { username } = req.query;
    let users = loadUsers();

    if (!users[username]) return res.status(400).json({ success: false, message: "User not found!" });

    const { name, email, accountNumber, cardNumber, address, dob, balance } = users[username];

    res.json({ success: true, name, email, accountNumber, cardNumber, address, dob, balance });
});

// ✅ Handle Bill Payment
app.post("/pay-bill", (req, res) => {
    const { username, billType, billNumber, amount, otp } = req.body;
    let users = loadUsers();

    if (!users[username] || !OTP_STORE[username] || OTP_STORE[username].otp !== otp || OTP_STORE[username].expires < Date.now()) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP!" });
    }

    if (users[username].balance < amount) {
        return res.status(400).json({ success: false, message: "Insufficient balance!" });
    }

    users[username].balance -= amount;
    users[username].transactions.push(`${new Date().toLocaleString()} - Paid ₹${amount} for ${billType} bill #${billNumber}`);

    saveUsers(users);
    delete OTP_STORE[username];

    res.json({ success: true, message: "Bill paid successfully!", newBalance: users[username].balance });
});

//pay emi payment deducting server
app.post("/pay-emi", (req, res) => {
    try {
        const { username, emiAmount, otp } = req.body;
        let users = loadUsers();

        //console.log("Received EMI Payment Request:", req.body); // ✅ Debugging Log

        // ✅ Validate input
        if (!username || !emiAmount || !otp) {
            console.error("❌ Missing Fields:", req.body);
            return res.status(400).json({ success: false, message: "All fields are required!" });
        }

        // ✅ Check if the user exists
        if (!users[username]) {
            console.error("❌ User Not Found:", username);
            return res.status(400).json({ success: false, message: "User not found!" });
        }

        // ✅ Validate OTP
        const storedOTP = OTP_STORE[username];
        //console.log("Stored OTP for User:", storedOTP); // ✅ Debugging
        if (!storedOTP || storedOTP.otp !== otp || storedOTP.expires < Date.now()) {
            console.error("❌ Invalid or Expired OTP for:", username);
            return res.status(400).json({ success: false, message: "Invalid or expired OTP!" });
        }

        // ✅ Ensure sufficient balance
        const emiAmountNum = parseFloat(emiAmount);
        if (isNaN(emiAmountNum) || emiAmountNum <= 0) {
            console.error("❌ Invalid EMI Amount:", emiAmount);
            return res.status(400).json({ success: false, message: "Invalid EMI amount!" });
        }
        if (users[username].balance < emiAmountNum) {
            console.error("❌ Insufficient Balance for:", username);
            return res.status(400).json({ success: false, message: "Insufficient balance!" });
        }

        // ✅ Deduct EMI amount
        users[username].balance -= emiAmountNum;

        // ✅ Store transaction in the same format as other transactions
    const transactionDetails = `${new Date().toLocaleString()} - EMI Payment of ₹${emiAmountNum}`;
    users[username].transactions.push(transactionDetails);
    

        // ✅ Save updated user data
        saveUsers(users);

        // ✅ Remove OTP after successful use
        delete OTP_STORE[username];

        console.log("✅ EMI Payment Successful for:", username);

        // ✅ Return success response
        res.json({ 
            success: true, 
            message: "EMI payment successful!", 
            newBalance: users[username].balance 
        });

    } catch (error) {
        console.error("❌ Server Error in /pay-emi:", error);
        res.status(500).json({ success: false, message: "Server error! Please try again later." });
    }
});


//pay recharge server side logic

app.post("/recharge", (req, res) => {
    const { username, amount, otp } = req.body;
    let users = loadUsers();

    // ✅ Check if the user exists
    if (!users[username]) {
        return res.status(400).json({ success: false, message: "User not found!" });
    }

    // ✅ Check if the OTP is valid
    if (!OTP_STORE[username] || OTP_STORE[username].otp !== otp || OTP_STORE[username].expires < Date.now()) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP!" });
    }

    // ✅ Check if the user has enough balance
    if (users[username].balance < amount) {
        return res.status(400).json({ success: false, message: "Insufficient balance!" });
    }

    // ✅ Deduct the Recharge amount from the balance
    users[username].balance -= amount;

    // ✅ Store the transaction
    const transactionDetails = `${new Date().toLocaleString()} - Recharge of ₹${amount}`;
    users[username].transactions.push(transactionDetails);

    // ✅ Save the updated user data
    saveUsers(users);

    // ✅ Remove used OTP
    delete OTP_STORE[username];

    res.json({ 
        success: true, 
        message: "Recharge successful!", 
        newBalance: users[username].balance 
    });
});
app.post("/verify-account", (req, res) => {
    const { accountNumber } = req.body;
    let users = loadUsers();

    // ✅ Find user with matching account number
    let recipientUsername = Object.keys(users).find(
        username => users[username].accountNumber === accountNumber
    );

    if (!recipientUsername) {
        return res.status(400).json({ success: false, message: "Account not found!" });
    }

    let recipient = users[recipientUsername];

    res.json({ success: true, username: recipientUsername, name: recipient.name });
});

app.post("/transfer-money", (req, res) => {
    const { username, recipientUsername, amount, otp } = req.body;
    let users = loadUsers();

    if (!users[username] || !users[recipientUsername]) {
        return res.status(400).json({ success: false, message: "Invalid sender or recipient!" });
    }

    if (!OTP_STORE[username] || OTP_STORE[username].otp !== otp || OTP_STORE[username].expires < Date.now()) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP!" });
    }

    if (users[username].balance < amount) {
        return res.status(400).json({ success: false, message: "Insufficient balance!" });
    }

    // ✅ Deduct from sender
    users[username].balance -= amount;
    users[username].transactions.push(`${new Date().toLocaleString()} - Sent ₹${amount} to ${users[recipientUsername].name}`);

    // ✅ Add to recipient
    users[recipientUsername].balance += amount;
    users[recipientUsername].transactions.push(`${new Date().toLocaleString()} - Received ₹${amount} from ${users[username].name}`);

    // ✅ Save the updated user data
    saveUsers(users);
    delete OTP_STORE[username];

    res.json({ success: true, message: "Money sent successfully!" });
});


// ✅ Handle Check Balance (Verify Password)
app.post("/check-balance", (req, res) => {
    const { username, password } = req.body;
    let users = loadUsers();

    if (!users[username] || users[username].password !== password) {
        return res.status(400).json({ success: false, message: "Invalid username or password!" });
    }

    res.json({ success: true, balance: users[username].balance });
});

// ✅ Serve index.html on root URL
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});



//admin page starts

const ADMIN_USERNAME = "ra-one";
const ADMIN_PASSWORD = "6203975553";

// ✅ Load Users Safely
function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, "utf8");
        return JSON.parse(data) || {};
    } catch (error) {
        console.error("Error loading users:", error);
        return {}; // Ensure it always returns an object
    }
    
}

// ✅ Save Users
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

// ✅ Admin Login
app.post("/admin-login", (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        return res.json({ success: true });
    }
    res.json({ success: false, message: "Invalid admin credentials!" });
});

// ✅ Get All Users
app.get("/getAllUsers", (req, res) => {
    const users = loadUsers();
    const userArray = Object.keys(users).map(username => ({
        username,  // ✅ Now username is included
        ...users[username]
    }));
    res.json(userArray);
});


// ✅ Get Specific User Details
app.get("/getUserDetails", (req, res) => {
    const username = req.query.username;
    let users = loadUsers();

    if (!username) {
        return res.status(400).json({ success: false, message: "Username parameter missing!" });
    }

    if (!users[username]) {
        console.log(`❌ User not found: ${username}`);
        return res.status(400).json({ success: false, message: "User not found!" });
    }

    console.log(`✅ User found: ${username}`, users[username]);

    res.json({ success: true, username, ...users[username] });  // ✅ Include username in response
});


// ✅ Update User Details
app.post("/updateUser", (req, res) => {
    const { username, name, balance, email, phone, address, password } = req.body;
    let users = loadUsers();

    if (!users[username]) {
        console.log(`❌ Cannot update. User not found: ${username}`);
        return res.status(400).json({ success: false, message: "User not found!" });
    }

    users[username] = { ...users[username], name, balance: parseFloat(balance), email, phone, address, password };
    saveUsers(users);

    console.log(`✅ User updated: ${username}`, users[username]);
    res.json({ success: true, message: "User details updated successfully!" });
});

// ✅ Delete User
app.post("/deleteUser", (req, res) => {
    const { username } = req.body;
    let users = loadUsers();

    if (!users[username]) {
        return res.json({ success: false, message: "User not found!" });
    }

    delete users[username];
    saveUsers(users);

    console.log(`✅ User deleted: ${username}`);
    res.json({ success: true, message: "User account deleted successfully!" });
});



//admin page ends

// ✅ Start Server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
