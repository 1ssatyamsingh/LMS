import { Webhook } from "svix";
import User from "../models/User.js";
import Stripe from "stripe";
import { Purchase } from "../models/Purchase.js";
import Course from "../models/Course.js";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

//////////////////////////////////////////////////////
// CLERK WEBHOOK
//////////////////////////////////////////////////////

export const clerkWebhooks = async (req, res) => {
  try {
    const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

    await whook.verify(JSON.stringify(req.body), {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });

    const { data, type } = req.body;

    switch (type) {
      case "user.created":
        await User.create({
          _id: data.id,
          email: data.email_addresses[0].email_address,
          name: data.first_name + " " + data.last_name,
          imageUrl: data.image_url,
        });
        break;

      case "user.updated":
        await User.findByIdAndUpdate(data.id, {
          email: data.email_addresses[0].email_address,
          name: data.first_name + " " + data.last_name,
          imageUrl: data.image_url,
        });
        break;

      case "user.deleted":
        await User.findByIdAndDelete(data.id);
        break;

      default:
        break;
    }

    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

//////////////////////////////////////////////////////
// STRIPE WEBHOOK
//////////////////////////////////////////////////////
export const stripeWebhooks = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    try {
      const { purchaseId } = session.metadata;

      const purchaseData = await Purchase.findById(purchaseId);

      if (!purchaseData) {
        console.error("Purchase not found");
        return res.json({ received: true });
      }

      const userData = await User.findById(purchaseData.userId);
      const courseData = await Course.findById(purchaseData.courseId);

      if (!userData || !courseData) {
        console.error("User or Course not found");
        return res.json({ received: true });
      }

      // Prevent duplicate enrollment
      if (!userData.enrolledCourses.includes(courseData._id)) {
        userData.enrolledCourses.push(courseData._id);
        await userData.save();
      }

      if (!courseData.enrolledStudents.includes(userData._id)) {
        courseData.enrolledStudents.push(userData._id);
        await courseData.save();
      }

      purchaseData.status = "completed";
      await purchaseData.save();

      console.log("✅ Payment successful & enrollment completed");
    } catch (error) {
      console.error("Webhook Error:", error);
    }
  }

  res.json({ received: true });
};