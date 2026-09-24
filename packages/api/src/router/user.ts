import bcryptjs from "bcryptjs";
import isEmpty from "lodash/isEmpty";
import mongoose from "mongoose";
import { decode, encode } from "next-auth/jwt";
import { createSecretKey } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import type { TPermission } from "@repo/nosql/schema/auth";
import { BmuModel, GroupModel, UserModel } from "@repo/nosql/schema/auth";

import { MailService, Templates } from "../lib/mail";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  adminProcedure,
} from "../trpc";
import { getAllBmuVariants } from "../utils/bmu-normalizer";

/**
 * We need to duplicate the validators here.
 * Since it will create a cyclic dependency in apps/isomorphic-i18n/src/validators/user.schema.ts
 */
export const UpsertUserSchema = z.object({
  _id: z
    .string()
    .refine((val) => {
      return mongoose.Types.ObjectId.isValid(val);
    })
    .optional(),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().optional(),
  role: z.string().min(1),
  status: z.string().min(1),
  bmuNames: z.array(z.object({ value: z.string(), label: z.string() })),
  userBmu: z.object({ value: z.string(), label: z.string() }).optional(),
  fisherId: z.string().optional(),
});

export const GenerateResetPasswordTokenSchema = z.object({
  email: z.string().min(1).email(),
});

const messages = {
  passwordRequired: "Password is required",
  passwordLengthMin: "Password must be at least 6 characters",
  passwordOneUppercase:
    "The Password must contain at least one uppercase character",
  passwordOneLowercase:
    "The Password must contain at least one lowercase character",
  passwordOneNumeric:
    "The password must contain at least one numerical character.",
} as const;

export const ResetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(1, { message: messages.passwordRequired })
      .min(6, { message: messages.passwordLengthMin })
      .regex(new RegExp(".*[A-Z].*"), {
        message: messages.passwordOneUppercase,
      })
      .regex(new RegExp(".*[a-z].*"), {
        message: messages.passwordOneLowercase,
      })
      .regex(new RegExp(".*\\d.*"), { message: messages.passwordOneNumeric }),
    confirmPassword: z
      .string()
      .min(1, { message: messages.passwordRequired })
      .min(6, { message: messages.passwordLengthMin })
      .regex(new RegExp(".*[A-Z].*"), {
        message: messages.passwordOneUppercase,
      })
      .regex(new RegExp(".*[a-z].*"), {
        message: messages.passwordOneLowercase,
      })
      .regex(new RegExp(".*\\d.*"), { message: messages.passwordOneNumeric }),
    token: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const secretKey = createSecretKey(process.env.NEXTAUTH_SECRET ?? "", "utf-8");

const now = () => (Date.now() / 1000) | 0;

export const userRouter = createTRPCRouter({
  all: protectedProcedure.query(async ({ ctx }) => {
    const users = await UserModel.find({}, { password: 0 })
      .populate([
        {
          path: "groups",
          populate: {
            path: "permission_id",
            model: "Permission",
            select: { name: true, domain: true },
          },
        },
        {
          path: "bmus",
          select: { BMU: true, group: true },
        },
        {
          path: "userBmu",
          select: { BMU: true, group: true },
        },
      ])
      .lean();

    /**
     * Transform all ObjectId to string to avoid RSC warnings.
     */
    return users.map((user) => ({
      ...user,
      _id: user._id.toString(),
      groups: user.groups.map((group) => ({
        ...group,
        _id: group._id.toString(),
        ...(group.permission_id && {
          permission_id: {
            ...group.permission_id,
            _id: group.permission_id._id.toString(),
            domain: (group.permission_id as unknown as TPermission)?.domain.map(
              (dom) => ({
                ...dom,
                _id: dom._id.toString(),
              })
            ),
          },
        }),
      })),
      bmus: user.bmus.map((bmu) => ({
        ...bmu,
        _id: bmu._id.toString(),
      })),
      ...(user.userBmu && {
        userBmu: {
          ...user.userBmu,
          _id: user.userBmu._id.toString(),
        },
      }),
    }));
  }),
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const user = await UserModel.findById(input.id)
        .select({ password: 0 })
        .populate([
          {
            path: "groups",
            populate: {
              path: "permission_id",
              model: "Permission",
            },
          },
          {
            path: "bmus",
            select: { BMU: true, group: true },
          },
          {
            path: "userBmu",
            select: { BMU: true, group: true },
          },
        ])
        .lean();

      return {
        ...user,
        role: user?.groups?.[0]?.name,
      };
    }),
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const result = await UserModel.findByIdAndDelete(input.id);

      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      return { success: true };
    }),
  allBmus: protectedProcedure.query(async () => {
    const bmus = await BmuModel.find({});
    return bmus;
  }),
  upsert: adminProcedure
    .input(UpsertUserSchema)
    .mutation(async ({ input }) => {
      const userGroup = await GroupModel.findOne({ name: input.role });
      
      const bmuLabels = input.bmuNames.map((bmu) => bmu.label);
      const bmuGroups = await BmuModel.find({
        BMU: { $in: getAllBmuVariants(bmuLabels) },
      });

      let userBmu = null;
      if (input.userBmu) {
        userBmu = await BmuModel.findOne({
          BMU: { $in: getAllBmuVariants([input.userBmu.label]) },
        });
      }
      const findOne = input._id ? { _id: input._id } : { email: input.email };
      const _user = await UserModel.findOneAndUpdate(
        findOne,
        {
          name: input.name,
          email: input.email,
          password: input.password
            ? await bcryptjs.hash(input.password, 12)
            : undefined,
          status: input.status,
          groups: [userGroup?._id],
          bmus: bmuGroups.map((bmu) => bmu._id),
          userBmu: userBmu?._id,
          fisherId: input.fisherId,
          ...(!isEmpty(input?.password) && {
            password: bcryptjs.hashSync(input?.password ?? "", 10),
          }),
        },
        { new: true, upsert: true }
      );
    }),
  generateResetPasswordToken: publicProcedure
    .input(GenerateResetPasswordTokenSchema)
    .mutation(async ({ input }) => {
      const user = await UserModel.findOne({ email: input.email });
      if (!user) throw new Error("User doesn't exist.");
      const reset_token = await encode({
        token: { id: user._id.toString() },
        secret: process.env.NEXTAUTH_SECRET ?? "",
        maxAge: 60 * 60, // 1 hr
      });

      /**
       * TODO: Load lang dynamically
       */
      const mail = new MailService();
      await mail.sendTemplateMessages(Templates.resetPassword, {
        to: user.email,
        subject: "Reset your password",
        resetLink: `${
          process.env.NODE_ENV === 'production'
            ? 'https://digitalfisheries.kenya.peskas.org'
            : process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3001'
        }/en/reset-password/${reset_token}`,
      });
    }),
  resetPassword: publicProcedure
    .input(ResetPasswordSchema)
    .mutation(async ({ input }) => {
      try {
        const payload = await decode({
          token: input.token,
          secret: process.env.NEXTAUTH_SECRET ?? "",
        });
        await UserModel.findOneAndUpdate(
          {
            _id: new mongoose.Types.ObjectId(payload?.id as string),
          },
          {
            password: bcryptjs.hashSync(input.newPassword ?? "", 10),
          }
        );
      } catch (e) {
        throw new Error("Invalid token.");
      }
    }),
});
