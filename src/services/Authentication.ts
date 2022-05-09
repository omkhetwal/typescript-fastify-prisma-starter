import { Prisma, PrismaClient } from "@prisma/client";

import { ILoginBody, IUser } from "../types/user.types";

import { AuthenticationToken } from "./AuthenticationToken";
import { AuthenticationPassword } from "./AuthenticationPassword";

/**
 * Class to abstract the higher level authentication logic away from
 * specific user actions
 */
class Authentication {
  db: any;

  constructor() {
    const prisma = new PrismaClient();
    this.db = prisma;
  }

  async createUser({ firstName, lastName, email, password }: Partial<IUser>) {
    if (!email || !firstName || !lastName || !password) {
      throw new Error("You must send all register details.");
    }

    if (!this.validateEmail(email)) {
      throw new Error("Please use a valid email address.");
    }

    const userExists = await this.doesUserExist(email);

    if (userExists) {
      throw new Error("User already registered.");
    }

    const authPassword = new AuthenticationPassword(password, null);
    const newUser = await this.saveUser(
      firstName,
      lastName,
      email,
      authPassword.hashPassword()
    );

    await this.logUserActivity(newUser.id, "signup");

    return newUser;
  }

  async loginUser({ email, password }: ILoginBody) {
    if (!email || !password) {
      throw new Error("You must send all login details.");
    }

    const userExists = await this.doesUserExist(email);
    if (!userExists) {
      throw new Error("No matching user.");
    }

    try {
      const authPassword = new AuthenticationPassword(
        password,
        userExists.password
      );
      await authPassword.compareHashedPassword();
    } catch (e) {
      throw e;
    }

    const token = new AuthenticationToken();
    await token.createToken({ ...userExists });
    await token.createRefreshToken(userExists.email);
    await this.logUserActivity(userExists.id, "login");

    return {
      id: userExists.id,
      authToken: token.token,
      refreshToken: token.refreshToken,
      firstName: userExists.firstName,
      lastName: userExists.lastName,
      email: userExists.email,
    };
  }

  logUserActivity(userId: number, activity: string) {
    return this.db.loginActivity.create({
      data: { userId, activityType: activity },
    });
  }

  doesUserExist(email: string) {
    const userEmailWhere: Prisma.UserWhereInput = {
      email: email,
    };

    return this.db.user.findUnique({
      where: userEmailWhere,
    });
  }

  validateEmail(email: string) {
    const re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }

  saveUser(first_name, last_name, email, passwordHash) {
    return this.db.user.create({
      data: {
        firstName: first_name,
        lastName: last_name,
        email: email,
        password: passwordHash,
      },
    });
  }
}

export { Authentication };
