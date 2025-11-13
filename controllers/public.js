import express from "express";
import User from "../models/user.js";
import Category from "../models/category.js";
import Expense from "../models/expense.js";
import { INTERNAL_SERVER_ERROR, HttpError } from "../utils/HttpError.js";

const router = express.Router();

// Public statistics endpoint - no authentication required
router.get("/stats", async (req, res) => {
  try {
    // Get total number of registered users
    const totalUsers = await User.countDocuments();
    
    // Get total number of categories
    const totalCategories = await Category.countDocuments();
    
    // Get total number of expenses (without revealing amounts)
    const totalExpenses = await Expense.countDocuments();
    
    // Get most popular categories by usage count
    const popularCategories = await Expense.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo"
        }
      },
      {
        $unwind: "$categoryInfo"
      },
      {
        $project: {
          name: "$categoryInfo.name",
          count: 1
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // Get application usage stats
    const appStats = {
      totalUsers,
      totalCategories,
      totalExpenses,
      popularCategories,
      applicationInfo: {
        name: "Expense Tracker",
        version: "1.0.0",
        description: "A comprehensive expense tracking application"
      }
    };

    res.status(200).json({
      success: true,
      data: appStats,
      message: "Public statistics retrieved successfully"
    });

  } catch (error) {
    console.error("Error fetching public statistics:", error);
    throw new HttpError(INTERNAL_SERVER_ERROR, "Failed to fetch statistics");
  }
});

export default router;