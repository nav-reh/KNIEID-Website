import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const settings = sqliteTable('settings', {key:text('key').primaryKey(),value:text('value').notNull()});
export const users = sqliteTable('portal_users', {id:text('id').primaryKey(),userId:text('user_id').unique(),email:text('email').notNull().unique(),name:text('name').notNull().default(''),role:text('role').notNull().default('pending'),blocked:integer('blocked').notNull().default(0),createdAt:text('created_at').notNull()});
export const information = sqliteTable('information', {id:text('id').primaryKey(),titleDe:text('title_de').notNull(),titleEn:text('title_en').notNull(),bodyDe:text('body_de').notNull(),bodyEn:text('body_en').notNull(),audience:text('audience').notNull(),updatedAt:text('updated_at').notNull()});
export const audit = sqliteTable('audit_log', {id:text('id').primaryKey(),actor:text('actor').notNull(),action:text('action').notNull(),target:text('target').notNull(),at:text('at').notNull()});
