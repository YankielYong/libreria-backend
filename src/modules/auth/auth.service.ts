import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { compareSync } from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../role/entities/role.entity';
import { RoleType } from 'src/util/enum/roletype.enum';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { SignUpDTO } from './dto/signup.dto';
import { SignInDTO } from './dto/signin.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly userServices: UserService,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async signup(signUpDTO: SignUpDTO) {
    const role = (await this.roleRepository.findOneBy({ name: RoleType.USER }))
      .id;
    const user = await this.userServices.create({ ...signUpDTO, role });
    return {
      ...user,
      token: this.getJwtToken({
        email: user.email,
        name: user.name,
        lastName: user.lastName,
      }),
    };
  }

  async signin(signInDTO: SignInDTO) {
    try {
      const { email, password } = signInDTO;

      const user = await this.userRepository.findOne({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Email not valid');
      }

      if (!compareSync(password, user.password))
        throw new UnauthorizedException('Password is wrong');

      return {
        ...user,
        token: this.getJwtToken({
          email: user.email,
          name: user.name,
          lastName: user.lastName,
        }),
      };
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async checkAuthStatus(user: User) {
    return {
      ...user,
      token: this.getJwtToken({
        email: user.email,
        name: user.name,
        lastName: user.lastName,
      }),
    };
  }

  private getJwtToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  private handleDBErrors(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);
    if (error.message === 'Email not valid')
      throw new UnauthorizedException('Email not valid');
    if (error.message === 'Password is wrong')
      throw new UnauthorizedException('Password is wrong');

    console.log(error);

    throw new InternalServerErrorException('Check console logs');
  }
}
