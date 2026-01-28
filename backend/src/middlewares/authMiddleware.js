import jwt from "jsonwebtoken";
import User from "../models/Users.js";

export const protectedRoute = async (req, res, next) => {
  try {
    // Lấy token từ header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Không tìm thấy access token" });
    }

    // Xác nhận token
    jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET,
      async (err, decodedUser) => {
        if (err) {
          console.error(err);

          return res
            .status(401)
            .json({ message: "Access token hết hạn hoặc không hợp lệ" });
        }

        // Tìm user
        const user = await User.findById(decodedUser.userId).select(
          "-hashedPassword"
        );
        if (!user) {
          return res.status(404).json({ message: "User không tồn tại" });
        }

        // Trả user trong req
        req.user = user;
        next();
      }
    );
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
