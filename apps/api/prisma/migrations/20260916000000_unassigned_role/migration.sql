-- PostgreSQL requires this enum value to be committed before it is used as a default.
ALTER TYPE "UserRole" ADD VALUE 'unassigned';
