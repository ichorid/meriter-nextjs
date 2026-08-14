import { Schema } from 'mongoose';

export const UZZ_COMMAND_MODEL = 'UzzCommand';

export const UzzCommandPersistenceSchema = new Schema(
  {
    commandId: { type: String, required: true },
    actorId: { type: String, required: true },
    type: { type: String, required: true },
    payloadHash: { type: String, required: true },
    status: {
      type: String,
      enum: ['started', 'completed', 'failed'],
      required: true,
    },
    result: { type: Schema.Types.Mixed },
    errorCode: { type: String },
  },
  { collection: 'uzz_commands', timestamps: true, versionKey: false },
);

UzzCommandPersistenceSchema.index(
  { actorId: 1, commandId: 1 },
  { unique: true, name: 'uzz_commands_actor_command_unique' },
);
UzzCommandPersistenceSchema.index({ actorId: 1, createdAt: -1 });
