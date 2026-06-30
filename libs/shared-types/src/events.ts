import { z } from "zod";
import { MeritTransferCreateProcedureInputSchema } from "./merit-transfer";

/** ST-4: Optional event date/time/location fields (publication entity + DTOs). */
export const EventOptionalDateFieldsSchema = z.object({
  eventStartDate: z.coerce.date().optional(),
  eventEndDate: z.coerce.date().optional(),
  eventTime: z.string().max(500).optional(),
  eventLocation: z.string().max(2000).optional(),
});

/** ST-4: Required event dates for dedicated event create inputs. */
export const EventRequiredDateFieldsSchema = z.object({
  eventStartDate: z.coerce.date(),
  eventEndDate: z.coerce.date(),
  eventTime: z.string().max(500).optional(),
  eventLocation: z.string().max(2000).optional(),
});

export const EventParticipantViewSchema = z.object({
  userId: z.string(),
  attendance: z.enum(["checked_in", "no_show"]).nullable().optional(),
  attendanceUpdatedAt: z.coerce.date().optional(),
  attendanceUpdatedByUserId: z.string().optional(),
});

export type EventParticipantView = z.infer<typeof EventParticipantViewSchema>;

/** ST-4: Event-only fields on Publication entity. */
export const EventPublicationFieldsSchema = EventOptionalDateFieldsSchema.extend({
  eventAttendees: z.array(z.string()).optional().default([]),
  eventParticipants: z.array(EventParticipantViewSchema).optional().default([]),
});

/** ST-1: Shared event date-order validation. */
export const EVENT_END_DATE_ORDER_MESSAGE =
  "eventEndDate must be on or after eventStartDate";

export const EVENT_DATES_REQUIRED_WHEN_POST_TYPE_EVENT_MESSAGE =
  "eventStartDate and eventEndDate are required when postType is event";

type EventDateFields = {
  eventStartDate?: Date | null;
  eventEndDate?: Date | null;
};

export function isEventEndDateOnOrAfterStart(
  eventStartDate: Date | null | undefined,
  eventEndDate: Date | null | undefined,
): boolean {
  if (eventStartDate != null && eventEndDate != null) {
    return eventEndDate >= eventStartDate;
  }
  return true;
}

export const eventEndDateOrderRefineCheck = (data: EventDateFields) =>
  isEventEndDateOnOrAfterStart(data.eventStartDate, data.eventEndDate);

export const eventEndDateOrderRefineConfig = {
  message: EVENT_END_DATE_ORDER_MESSAGE,
  path: ["eventEndDate"],
};

export function eventDatesRequiredWhenPostTypeEvent(data: {
  postType?: string;
  eventStartDate?: Date | null;
  eventEndDate?: Date | null;
}): boolean {
  if (data.postType !== "event") return true;
  return data.eventStartDate != null && data.eventEndDate != null;
}

export const eventDatesRequiredWhenPostTypeEventRefineConfig = {
  message: EVENT_DATES_REQUIRED_WHEN_POST_TYPE_EVENT_MESSAGE,
  path: ["eventStartDate"],
};

export function eventEndDateOrderWhenPostTypeEvent(data: {
  postType?: string;
  eventStartDate?: Date | null;
  eventEndDate?: Date | null;
}): boolean {
  if (data.postType !== "event") return true;
  return isEventEndDateOnOrAfterStart(data.eventStartDate, data.eventEndDate);
}

/** PublicationSchema superRefine helper for postType === 'event'. */
export function addEventPublicationValidationIssues(
  data: {
    postType?: string;
    eventStartDate?: Date | null;
    eventEndDate?: Date | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (data.postType !== "event") return;

  if (data.eventStartDate == null) {
    ctx.addIssue({
      code: "custom",
      message: "eventStartDate is required when postType is event",
      path: ["eventStartDate"],
    });
  }
  if (data.eventEndDate == null) {
    ctx.addIssue({
      code: "custom",
      message: "eventEndDate is required when postType is event",
      path: ["eventEndDate"],
    });
  }
  if (!isEventEndDateOnOrAfterStart(data.eventStartDate, data.eventEndDate)) {
    ctx.addIssue({
      code: "custom",
      message: EVENT_END_DATE_ORDER_MESSAGE,
      path: ["eventEndDate"],
    });
  }
}

/** Payload for creating an event post (`postType === 'event'`). */
export const EventCreateInputSchema = z
  .object({
    communityId: z.string().min(1),
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(5000),
    content: z.string().min(1).max(10000),
    type: z.enum(["text", "image", "video"]),
  })
  .merge(EventRequiredDateFieldsSchema)
  .strict()
  .refine(eventEndDateOrderRefineCheck, eventEndDateOrderRefineConfig);

export type EventCreateInput = z.infer<typeof EventCreateInputSchema>;

export const EventUpdateInputSchema = z
  .object({
    publicationId: z.string().min(1),
    title: z.string().min(1).max(500).optional(),
    description: z.string().min(1).max(5000).optional(),
    content: z.string().min(1).max(10000).optional(),
    type: z.enum(["text", "image", "video"]).optional(),
  })
  .merge(EventOptionalDateFieldsSchema)
  .refine(eventEndDateOrderRefineCheck, eventEndDateOrderRefineConfig);

export type EventUpdateInput = z.infer<typeof EventUpdateInputSchema>;

/** API view of an event post (subset + RSVP). */
export const EventPublicationViewSchema = z
  .object({
    id: z.string(),
    communityId: z.string(),
    authorId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    content: z.string(),
    type: z.enum(["text", "image", "video"]),
    postType: z.literal("event"),
    /** Derived: user ids in participant list (RSVP + attendance rows). */
    eventAttendees: z.array(z.string()),
    eventParticipants: z.array(EventParticipantViewSchema).optional().default([]),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .merge(EventRequiredDateFieldsSchema);

export type EventPublicationView = z.infer<typeof EventPublicationViewSchema>;

export const EventInviteCreateOptionsSchema = z.object({
  maxUses: z.number().int().positive().nullable().optional(),
  /** When true, equivalent to maxUses === 1. */
  oneTime: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export type EventInviteCreateOptions = z.infer<typeof EventInviteCreateOptionsSchema>;

export const EventInviteRecordSchema = z.object({
  id: z.string(),
  eventPostId: z.string(),
  token: z.string(),
  maxUses: z.number().int().positive().nullable().optional(),
  usedCount: z.number().int().min(0),
  createdBy: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export type EventInviteRecord = z.infer<typeof EventInviteRecordSchema>;

export const EventsGetByCommunityInputSchema = z.object({
  communityId: z.string().min(1),
});

export const EventsDeleteInputSchema = z.object({
  publicationId: z.string().min(1),
});

export const EventsCreateInviteLinkInputSchema = z.object({
  publicationId: z.string().min(1),
  options: EventInviteCreateOptionsSchema.optional(),
});

export const EventsInvitePreviewInputSchema = z.object({
  token: z.string().min(1),
});

export const EventsAttendViaInviteInputSchema = z.object({
  token: z.string().min(1),
});

export const EventsSetParticipantAttendanceInputSchema = z.object({
  publicationId: z.string().min(1),
  targetUserId: z.string().min(1),
  attendance: z.enum(["checked_in", "no_show"]).nullable(),
});

export type EventsSetParticipantAttendanceInput = z.infer<
  typeof EventsSetParticipantAttendanceInputSchema
>;

export const EventsCheckInByTokenInputSchema = z.object({
  token: z.string().min(1),
});

export const EventsGetMyCheckInTokenInputSchema = z.object({
  publicationId: z.string().min(1),
});

export const EventsInviteUserInputSchema = z.object({
  publicationId: z.string().min(1),
  targetUserId: z.string().min(1),
});

export const EventsTransferMeritInEventInputSchema =
  MeritTransferCreateProcedureInputSchema.safeExtend({
    publicationId: z.string().min(1),
  });

export type EventsTransferMeritInEventInput = z.infer<typeof EventsTransferMeritInEventInputSchema>;
