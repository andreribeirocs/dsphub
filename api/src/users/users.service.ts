import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { User, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";

// Constants
const BCRYPT_ROUNDS = 10;

interface CreateUserData {
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly role: UserRole;
}

type UserWithoutPassword = Omit<User, "password">;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by their ID
   * @param id - User ID
   * @returns User without password field
   * @throws NotFoundException if user not found
   */
  async findById(id: string): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Find a user by their email address
   * @param email - User email
   * @returns Complete user object including password (for authentication)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Create a new user with hashed password
   * @param data - User creation data
   * @returns Created user without password field
   */
  async createUser(data: CreateUserData): Promise<UserWithoutPassword> {
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
