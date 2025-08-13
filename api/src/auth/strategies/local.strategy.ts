import { Strategy } from "passport-local";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth.service";

interface ValidatedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
}

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: "email" });
  }

  /**
   * Validate user credentials for local authentication
   * @param email - User email
   * @param password - User password
   * @returns Validated user object
   * @throws UnauthorizedException if credentials are invalid
   */
  async validate(email: string, password: string): Promise<ValidatedUser> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return user;
  }
}
