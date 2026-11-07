import { MEMBER_CATEGORIES as CATEGORIES, PRIORITIES } from "../requests/types";
import { bangkokDate } from "../visitor-request/validation";

export type RequestFormValues = {
  title: string; category: string; priority: string;
  description: string; location: string; neededBy: string;
};
export type RequestFormErrors = Partial<Record<keyof RequestFormValues, string>>;

/** Client-side checks only; the API still validates every request on its own.
 *  Limits mirror the form's maxLength attributes. */
export function validateRequestForm(values: RequestFormValues, today = bangkokDate()): RequestFormErrors {
  const errors: RequestFormErrors = {};
  const title = values.title.trim();
  if (!title) errors.title = "Enter a request title.";
  else if (title.length > 200) errors.title = "Use 200 characters or fewer.";
  if (!Object.hasOwn(CATEGORIES, values.category)) errors.category = "Choose a category.";
  if (!(PRIORITIES as readonly string[]).includes(values.priority)) errors.priority = "Choose a priority.";
  const description = values.description.trim();
  if (!description) errors.description = "Describe what you need.";
  else if (description.length > 4000) errors.description = "Use 4000 characters or fewer.";
  if (values.location.trim().length > 200) errors.location = "Use 200 characters or fewer.";
  if (values.neededBy) {
    const date = new Date(`${values.neededBy}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.neededBy) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== values.neededBy) {
      errors.neededBy = "Choose a valid date.";
    } else if (values.neededBy < today) errors.neededBy = "Choose today or a future date (Thailand time).";
  }
  return errors;
}
