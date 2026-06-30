import { z } from "zod";
import { MeritTransferCreateProcedureInputSchema } from "./merit-transfer";

/** Payload for creating an event post (`postType === 'event'`). */
export const EventCreateInputSchema = z
  .object({
    communityId: z.string().min(1),
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(5000),
    content: z.string().min(1).max(10000),
    type: z.enum(["text", "image", "video"]),
    eventStartDate: z.coerce.date(),
    eventEndDate: z.coerce.date(),
    eventTime: z.string().max(500).optional(),
    eventLocation: z.string().max(2000).optional(),
  })
  .strict()
  .refine((d) => d.eventEndDate >= d.eventStartDate, {
    message: "eventEndDate must be on or after eventStartDate",
    path: ["eventEndDate"],
  });

export type EventCreateInput = z.infer<typeof EventCreateInputSchema>;

export const EventUpdateInputSchema = z
  .object({
    publicationId: z.string().min(1),
    title: z.string().min(1).max(500).optional(),
    description: z.string().min(1).max(5000).optional(),
    content: z.string().min(1).max(10000).optional(),
    type: z.enum(["text", "image", "video"]).optional(),
    eventStartDate: z.coerce.date().optional(),
    eventEndDate: z.coerce.date().optional(),
    eventTime: z.string().max(500).optional(),
    eventLocation: z.string().max(2000).optional(),
  })
  .refine(
    (d) => {
      if (d.eventStartDate != null && d.eventEndDate != null) {
        return d.eventEndDate >= d.eventStartDate;
      }
      return true;
    },
    {
      message: "eventEndDate must be on or after eventStartDate",
      path: ["eventEndDate"],
    },
  );

export type EventUpdateInput = z.infer<typeof EventUpdateInputSchema>;

export const EventParticipantViewSchema = z.object({
  userId: z.string(),
  attendance: z.enum(["checked_in", "no_show"]).nullable().optional(),
  attendanceUpdatedAt: z.coerce.date().optional(),
  attendanceUpdatedByUserId: z.string().optional(),
});

export type EventParticipantView = z.infer<typeof EventParticipantViewSchema>;

/** API view of an event post (subset + RSVP). */
export const EventPublicationViewSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  authorId: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z.string(),
  type: z.enum(["text", "image", "video"]),
  postType: z.literal("event"),
  eventStartDate: z.coerce.date(),
  eventEndDate: z.coerce.date(),
  eventTime: z.string().optional(),
  eventLocation: z.string().optional(),
  /** Derived: user ids in participant list (RSVP + attendance rows). */
  eventAttendees: z.array(z.string()),
  eventParticipants: z.array(EventParticipantViewSchema).optional().default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

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
