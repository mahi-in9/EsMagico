const express = require("express");
const {
  resetPasswordControllers,
  register,
  login,
  getUser,
  forgotPasswordControllers,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPasswordControllers);
router.post("/reset-password/:token", resetPasswordControllers);

router.use(authMiddleware);
router.get("/me", getUser);

module.exports = router;
