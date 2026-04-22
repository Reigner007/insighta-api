import { Request, Response, NextFunction } from "express";

const VALID_GENDERS = ["male", "female"];
const VALID_AGE_GROUPS = ["child", "teenager", "adult", "senior"];
const VALID_SORT_BY = ["age", "created_at", "gender_probability"];
const VALID_ORDERS = ["asc", "desc"];

export function validateProfileQuery(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const {
    gender,
    age_group,
    min_age,
    max_age,
    min_gender_probability,
    min_country_probability,
    sort_by,
    order,
    page,
    limit,
  } = req.query;

  if (gender !== undefined) {
    if (typeof gender !== "string" || !VALID_GENDERS.includes(gender)) {
      res.status(422).json({
        status: "error",
        message: `Invalid query parameters: gender must be one of ${VALID_GENDERS.join(", ")}`,
      });
      return;
    }
  }

  if (age_group !== undefined) {
    if (typeof age_group !== "string" || !VALID_AGE_GROUPS.includes(age_group)) {
      res.status(422).json({
        status: "error",
        message: `Invalid query parameters: age_group must be one of ${VALID_AGE_GROUPS.join(", ")}`,
      });
      return;
    }
  }

  if (min_age !== undefined) {
    const val = Number(min_age);
    if (isNaN(val) || !Number.isInteger(val) || val < 0) {
      res.status(422).json({
        status: "error",
        message: "Invalid query parameters: min_age must be a non-negative integer",
      });
      return;
    }
  }

  if (max_age !== undefined) {
    const val = Number(max_age);
    if (isNaN(val) || !Number.isInteger(val) || val < 0) {
      res.status(422).json({
        status: "error",
        message: "Invalid query parameters: max_age must be a non-negative integer",
      });
      return;
    }
  }

  if (min_age !== undefined && max_age !== undefined) {
    if (Number(min_age) > Number(max_age)) {
      res.status(422).json({
        status: "error",
        message: "Invalid query parameters: min_age cannot be greater than max_age",
      });
      return;
    }
  }

  if (min_gender_probability !== undefined) {
    const val = Number(min_gender_probability);
    if (isNaN(val) || val < 0 || val > 1) {
      res.status(422).json({
        status: "error",
        message: "Invalid query parameters: min_gender_probability must be a float between 0 and 1",
      });
      return;
    }
  }

  if (min_country_probability !== undefined) {
    const val = Number(min_country_probability);
    if (isNaN(val) || val < 0 || val > 1) {
      res.status(422).json({
        status: "error",
        message: "Invalid query parameters: min_country_probability must be a float between 0 and 1",
      });
      return;
    }
  }

  if (sort_by !== undefined) {
    if (typeof sort_by !== "string" || !VALID_SORT_BY.includes(sort_by)) {
      res.status(422).json({
        status: "error",
        message: `Invalid query parameters: sort_by must be one of ${VALID_SORT_BY.join(", ")}`,
      });
      return;
    }
  }

  if (order !== undefined) {
    if (typeof order !== "string" || !VALID_ORDERS.includes(order)) {
      res.status(422).json({
        status: "error",
        message: `Invalid query parameters: order must be one of ${VALID_ORDERS.join(", ")}`,
      });
      return;
    }
  }

  if (page !== undefined) {
    const val = Number(page);
    if (isNaN(val) || !Number.isInteger(val) || val < 1) {
      res.status(422).json({
        status: "error",
        message: "Invalid query parameters: page must be a positive integer",
      });
      return;
    }
  }

  if (limit !== undefined) {
    const val = Number(limit);
    if (isNaN(val) || !Number.isInteger(val) || val < 1 || val > 50) {
      res.status(422).json({
        status: "error",
        message: "Invalid query parameters: limit must be an integer between 1 and 50",
      });
      return;
    }
  }

  next();
}