import Course from "../models/Course.js";
import { applyCors } from "../utils/cors.js";

// Get All Courses
export const getAllCourse = async (req, res) => {

  // ✅ Apply CORS
  if (applyCors(req, res)) return;

  try {
    const courses = await Course.find({ isPublished: true })
      .select(['-courseContent', '-enrolledStudents'])
      .populate({ path: 'educator' });

    res.json({ success: true, courses });

  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Get Course by Id
export const getCourseId = async (req, res) => {

  // ✅ Apply CORS
  if (applyCors(req, res)) return;

  const { id } = req.params;

  try {
    const courseData = await Course.findById(id)
      .populate({ path: 'educator' });

    // ❗ Safety check (important)
    if (!courseData) {
      return res.json({ success: false, message: "Course not found" });
    }

    // Remove lectureUrl if not preview free
    courseData.courseContent.forEach(chapter => {
      chapter.chapterContent.forEach(lecture => {
        if (!lecture.isPreviewFree) {
          lecture.lectureUrl = "";
        }
      });
    });

    res.json({ success: true, courseData });

  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};