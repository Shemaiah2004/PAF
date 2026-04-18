import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createHttpError } from "../utils/httpError.js";

function normalizeRole(role) {
  const normalizedRole = typeof role === "string" ? role.trim().toUpperCase() : "";
  return ["ADMIN", "TECHNICIAN", "USER"].includes(normalizedRole)
    ? normalizedRole
    : "USER";
}

function getForwardedSessionUser(req) {
  const email = req.headers["x-auth-user-email"];
  if (typeof email !== "string" || !email.trim()) {
    return null;
  }

  const fullNameHeader = req.headers["x-auth-user-name"];
  const roleHeader = req.headers["x-auth-user-role"];
  const externalAuthIdHeader = req.headers["x-auth-user-id"];
  const providerHeader = req.headers["x-auth-user-provider"];
  const fallbackName = email.split("@")[0] || "PAF User";

  return {
    email: email.trim().toLowerCase(),
    fullName:
      typeof fullNameHeader === "string" && fullNameHeader.trim()
        ? fullNameHeader.trim()
        : fallbackName,
    role: normalizeRole(roleHeader),
    externalAuthId:
      typeof externalAuthIdHeader === "string" && externalAuthIdHeader.trim()
        ? externalAuthIdHeader.trim()
        : null,
    authProvider:
      typeof providerHeader === "string" && providerHeader.trim()
        ? providerHeader.trim()
        : "SPRING_SESSION",
  };
}

async function syncForwardedSessionUser(sessionUser) {
  let user = await User.findOne({ email: sessionUser.email });

  if (!user) {
    const passwordHash = await bcrypt.hash(
      `external:${sessionUser.email}:${env.jwtSecret}`,
      10
    );

    user = await User.create({
      fullName: sessionUser.fullName,
      email: sessionUser.email,
      externalAuthId: sessionUser.externalAuthId,
      authProvider: sessionUser.authProvider,
      passwordHash,
      role: sessionUser.role,
      isActive: true,
    });

    console.info("[ticketing-api] Created ticketing user from app session", {
      email: sessionUser.email,
      role: sessionUser.role,
    });

    return user.toObject();
  }

  let changed = false;

  if (user.fullName !== sessionUser.fullName) {
    user.fullName = sessionUser.fullName;
    changed = true;
  }

  if (user.role !== sessionUser.role) {
    user.role = sessionUser.role;
    changed = true;
  }

  if (sessionUser.externalAuthId && user.externalAuthId !== sessionUser.externalAuthId) {
    user.externalAuthId = sessionUser.externalAuthId;
    changed = true;
  }

  if (user.authProvider !== sessionUser.authProvider) {
    user.authProvider = sessionUser.authProvider;
    changed = true;
  }

  if (!user.isActive) {
    user.isActive = true;
    changed = true;
  }

  if (changed) {
    await user.save();
  }

  return user.toObject();
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    const forwardedSessionUser = getForwardedSessionUser(req);
    if (!forwardedSessionUser) {
      throw createHttpError(401, "Authentication required.");
    }

    req.user = await syncForwardedSessionUser(forwardedSessionUser);
    next();
    return;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).lean();

    if (!user || !user.isActive) {
      throw createHttpError(401, "Your session is no longer valid.");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw createHttpError(401, "Invalid or expired token.");
  }
});

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(createHttpError(401, "Authentication required."));
    }

    if (!roles.includes(req.user.role)) {
      return next(createHttpError(403, "You do not have access to this action."));
    }

    next();
  };
}
