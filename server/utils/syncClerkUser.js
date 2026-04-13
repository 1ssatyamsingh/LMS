import { clerkClient } from "@clerk/express";
import User from "../models/User.js";

export const syncClerkUser = async (userId) => {
  if (!userId) {
    throw new Error("Missing Clerk user id");
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const email =
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    clerkUser.primaryEmailAddress?.emailAddress ||
    "unknown@example.com";
  const firstName = clerkUser.firstName || "";
  const lastName = clerkUser.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim() || email.split("@")[0] || "User";
  const imageUrl = clerkUser.imageUrl || "";

  const user = await User.findByIdAndUpdate(
    userId,
    {
      _id: userId,
      email,
      name: fullName,
      imageUrl,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return user;
};
