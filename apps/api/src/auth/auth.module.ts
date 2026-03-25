import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  Organization,
  Team,
  User,
  ApiKey,
  JwtAuthGuard,
  RolesGuard,
} from '@aegis/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { OrganizationController } from './organization.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '15m') as any,
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Organization, Team, User, ApiKey]),
  ],
  controllers: [AuthController, ApiKeyController, OrganizationController],
  providers: [
    AuthService,
    JwtStrategy,
    ApiKeyService,
    SeedService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, ApiKeyService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
