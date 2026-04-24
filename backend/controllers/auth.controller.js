const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const { compareSync, hashSync } = require("bcrypt");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const register = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const { title, password } = req.body;
    let role;
    if (req.body.role) {
      role = req.body.role;
    }

    const findUser = await User.findOne({ email });
    if (findUser)
      return res
        .status(400)
        .json({ success: false, message: "user already exists." });

    if (role === "admin") {
      role = "admin";
    } else {
      role = "user";
    }

    const hashedPassword = hashSync(password, 10);
    const user = await User.create({
      title,
      email,
      password: hashedPassword,
      role: role,
    });

    return res.status(201).json({
      success: true,
      message: "user created successfully",
      data: user,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Invalid credentials" });

    const match = compareSync(password, user.password);

    if (!match)
      return res
        .status(401)
        .json({ success: false, message: "Incorrect password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res
      .status(200)
      .json({ success: true, message: "login successfull", token, user });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

const getUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("-password");

    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "user not found" });

    res
      .status(200)
      .json({ success: true, message: "user fetched successfully", user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const forgotPasswordControllers = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) return res.status(400).json({ msg: "Email required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ msg: "User not found with that email" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = Date.now() + 3600000;

    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const mailOptions = {
      from: `"HabitLeaf Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Your Password - HabitLeaf",
      html: `
  <div style="font-family: Arial, sans-serif; background-color:#f9fafb; padding:30px;">
  <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  
  <div style="background:linear-gradient(90deg,#16a34a,#22c55e); padding:20px; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:22px; font-weight:600;">🌱 HabitLeaf</h1>
      </div>

      <div style="padding:30px; color:#374151;">
        <h2 style="margin-top:0; font-size:20px; color:#111827;">Password Reset Request</h2>
        <p style="font-size:15px; line-height:1.6;">Hello <b>${user.title}</b>,</p>
        <p style="font-size:15px; line-height:1.6;">
        We received a request to reset your HabitLeaf account password.  
        If this was you, click the button below to set a new password:
        </p>
        
        <div style="text-align:center; margin:30px 0;">
        <a href="${resetUrl}" 
        style="background-color:#16a34a; color:#ffffff; padding:12px 28px; border-radius:6px; text-decoration:none; font-weight:600; font-size:15px; display:inline-block;">
        Reset Password
        </a>
        </div>
        
        <p style="font-size:14px; line-height:1.6; color:#6b7280;">
        ⚠️ This link will expire in <b>1 hour</b>.  
        If you didn’t request this, please ignore this email.
        </p>
        
        <p style="font-size:14px; margin-top:25px;">Best regards, <br/>🌿 The HabitLeaf Team</p>
      </div>
      
      <div style="background:#f3f4f6; padding:15px; text-align:center; font-size:12px; color:#6b7280;">
      © ${new Date().getFullYear()} HabitLeaf, Inc. All rights reserved.  
        <br/>
        Need help? <a href="mailto:support@habitleaf.com" style="color:#16a34a; text-decoration:none;">Contact Support</a>
        </div>
        </div>
        </div>
        `,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error("Error sending email:", err);
        return res.status(500).json({ msg: "Failed to send email" });
      }
      res.json({ msg: "Reset link sent to your email" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

const resetPasswordControllers = async (req, res) => {
  try {
    const resetPassToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: resetPassToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ msg: "Invalid or expired token" });

    const hashedPassword = await bcrypt.hash(req.body.password, 8);
    user.password = hashedPassword;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.json({ msg: "Password reset successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = {
  register,
  login,
  getUser,
  forgotPasswordControllers,
  resetPasswordControllers,
};
