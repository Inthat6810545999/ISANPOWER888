"use server";

import { revalidatePath } from "next/cache";
import {
  REQUEST_STATUSES,
  REQUEST_TYPES,
  createLabRequest,
  updateLabRequestStatus,
  type RequestStatus,
  type RequestType,
} from "@/lib/api";

export type FormState = { error?: string; success?: boolean };

export async function submitLabRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const requesterEmail = String(formData.get("requesterEmail") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title || !requesterEmail) {
    return { error: "Title and requester email are required." };
  }
  if (!REQUEST_TYPES.includes(type as RequestType)) {
    return { error: "Please choose a valid request type." };
  }

  try {
    await createLabRequest({
      title,
      description,
      type: type as RequestType,
      requesterEmail,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function changeStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !REQUEST_STATUSES.includes(status as RequestStatus)) return;

  await updateLabRequestStatus(id, status as RequestStatus);
  revalidatePath("/");
}
