import { Webhook } from "svix";
import User from "../models/User.js";
import Stripe from "stripe";
import  Purchase  from "../models/Purchase.js";
import Course from "../models/Course.js";
import dotenv from "dotenv";

dotenv.config();

//////////////////////////////////////////////////////
// CLERK WEBHOOK
//////////////////////////////////////////////////////

export const clerkWebhooks = async (req, res) => {
  try {
    console.log("🔥 Clerk webhook HIT");
    if (!process.env.CLERK_WEBHOOK_SECRET) {
      throw new Error("Missing CLERK_WEBHOOK_SECRET");
    }

    const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    const payloadString = req.body.toString();

    const payload = whook.verify(payloadString, {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });
    const { data, type } = payload;
    const email = data.email_addresses?.[0]?.email_address || "unknown@example.com";
    const firstName = data.first_name || "";
    const lastName = data.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim() || email.split("@")[0] || "User";
    const imageUrl = data.image_url || "";

    switch (type) {
      case "user.created":
        console.log("Creating user...");

        await User.findByIdAndUpdate(data.id, {
          _id: data.id,
          email,
          name: fullName,
          imageUrl,
        }, { upsert: true, new: true, setDefaultsOnInsert: true });

        console.log("✅ User created in DB");
        break;

      case "user.updated":
        await User.findByIdAndUpdate(
          data.id,
          {
            _id: data.id,
            email,
            name: fullName,
            imageUrl,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        break;

      case "user.deleted":
        await User.findByIdAndDelete(data.id);
        break;

      default:
        break;
    }

    res.json({ success: true });
  }catch (error) {
    console.error("CLERK WEBHOOK ERROR:", error); // 🔥 important
    res.status(500).json({ success: false, message: error.message });
  }
}

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)

export const stripeWebhooks = async(request,response)=>{
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  }
  catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
  }


  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':{
      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;

      const session = await stripeInstance.checkout.sessions.list({
        payment_intent: paymentIntentId
      })

      const {purchaseId} = session.data[0].metadata;

      const purchaseData = await Purchase.findById(purchaseId);
      if (!purchaseData) return response.json({ received: true });

      const userData = await User.findById(purchaseData.userId);
      if (!userData) {
        console.log("User not found!");
        return response.json({ received: true });
      }

      const courseData = await Course.findById(purchaseData.courseId);
      if (!courseData) return response.json({ received: true });

      courseData.enrolledStudents.push(userData)
      await courseData.save()

      userData.enrolledCourses.push(courseData._id)
      await userData.save()

      purchaseData.status = 'completed'
      await purchaseData.save()

      break;
    }

    case 'payment_intent.payment_failed':{
      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;

      const session = await stripeInstance.checkout.sessions.list({
        payment_intent: paymentIntentId
      })

      const {purchaseId} = session.data[0].metadata;
      const purchaseData = await Purchase.findById(purchaseId)
      purchaseData.status = 'failed'
      await purchaseData.save()
    
      break;
    }
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  response.json({received: true});
}
