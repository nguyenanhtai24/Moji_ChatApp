import bcrypt from "bcrypt";
import User from "../models/Users.js";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Session from "../models/Session.js";

const ACCESS_TOKEN_EXPIRE_TTL = "30m";
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds

dotenv.config();

export const signUp = async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;

    if (!username || !password || !email || !firstName || !lastName) {
      return res.status(400).json({
        message: "Không được để trống các trường bắt buộc",
      });
    }

    // Kiem tra username ton tai chua
    const duplicateUsername = await User.findOne({ username });
    if (duplicateUsername) {
      return res.status(409).json({
        message: "Username đã tồn tại, vui lòng chọn username khác",
      });
    }

    // ma hoa mat khau
    const hashedPassword = await bcrypt.hash(password, 10); // salt = 10

    // tao user moi
    await User.create({
      username,
      hashedPassword,
      email,
      displayName: `${lastName} ${firstName}`,
    });

    return res.sendStatus(204);
  } catch (error) {
    console.error("Lỗi đăng ký tài khoản:", error);
    return res
      .status(500)
      .json({ message: "Lỗi máy chủ, vui lòng thử lại sau" });
  }
};

export const signIn = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Không được để trống các trường bắt buộc",
      });
    }

    // lay hashedPassword tu db
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({
        message: "Sai tên đăng nhập hoặc mật khẩu",
      });
    }

    const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordCorrect) {
      return res
        .status(401)
        .json({ message: "Sai tên đăng nhập hoặc mật khẩu" });
    }

    // neu khop, tao accessToken voi JWT
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRE_TTL },
    );

    // tao refreshToken
    const refreshToken = crypto.randomBytes(64).toString("hex");

    // tao session luu refreshToken vao db
    await Session.create({
      userId: user._id,
      refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
    });

    // tra refreshToken ve trong cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none", // Cho phép backend và frontend khác domain
      maxAge: REFRESH_TOKEN_TTL,
    });

    console.log(">>>đăng nhập thành công");

    return res.status(200).json({
      message: `User ${username.displayName} signed in successfully}`,
      accessToken,
    });
  } catch (error) {
    console.error("Lỗi đăng nhập tài khoản:", error);
    return res
      .status(500)
      .json({ message: "Lỗi máy chủ, vui lòng thử lại sau" });
  }
};

export const signOut = async (req, res) => {
  try {
    // Lấy refreshToken từ cookie
    const token = req.cookies.refreshToken;

    if (!token) {
      // xóa refresh token trong Session
      await Session.deleteOne({ refreshToken: token });
      // xóa cookie
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });
    }

    return res.sendStatus(204);
  } catch (error) {
    console.error("Lỗi đăng xuất tài khoản:", error);
    return res
      .status(500)
      .json({ message: "Lỗi máy chủ, vui lòng thử lại sau" });
  }
};

// Tạo access token mới sử dụng refresh token
export const refreshToken = async (req, res) => {
  try {
    // Lấy refreshToken từ cookie
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "Không tìm thấy token" });
    }

    // Kiểm tra token trong Session
    const session = await Session.findOne({ refreshToken: token });
    if (!session) {
      return res.status(403).json({ message: "Token không hợp lệ" });
    }

    // Kiểm tra token đã hết hạn chưa
    if (session.expiresAt < new Date()) {
      // Xóa session đã hết hạn
      await Session.deleteOne({ refreshToken: token });
      return res
        .status(403)
        .json({ message: "Token đã hết hạn, vui lòng đăng nhập lại" });
    }

    // Tạo access token mới
    const accessToken = jwt.sign(
      {
        userId: session.userId,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRE_TTL },
    );

    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error("Lỗi làm mới token:", error);
    return res
      .status(500)
      .json({ message: "Lỗi máy chủ, vui lòng thử lại sau" });
  }
};
