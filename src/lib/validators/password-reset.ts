import { z } from "zod";
import { requiredEmail } from "./shared";

/** The recovery request form. The address is the only field it takes. */
export const forgotPasswordSchema = z.object({ email: requiredEmail });
