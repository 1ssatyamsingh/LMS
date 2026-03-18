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
    // const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

    await whook.verify(req.body, {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });
    const payload = JSON.parse(req.body.toString());
    const { data, type } = payload;

    switch (type) {
      case "user.created":
        console.log("Creating user...");

        await User.create({
          _id: data.id,
          email: data.email_addresses?.[0]?.email_address || "",
          name: `${data.first_name || ""} ${data.last_name || ""}`,
          imageUrl: data.image_url,
        });

        console.log("✅ User created in DB");
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