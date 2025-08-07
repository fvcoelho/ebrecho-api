# eBrecho API

Backend API for the eBrecho marketplace platform.

## Commands

### Development
- `npm run dev` - Start development server with hot reload using tsx
- `npm run build` - Build TypeScript to JavaScript in dist/
- `npm start` - Run production server from dist/
- `npm run lint` - Run ESLint on TypeScript files
- `npm run format` - Format code with Prettier

### Database (Prisma)
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations in development
- `npm run prisma:deploy` - Deploy migrations to production
- `npm run prisma:seed` - Seed database with initial data
- `npm run prisma:studio` - Open Prisma Studio GUI
- `npm run prisma:reset` - Reset database and re-run migrations

### Testing
- `npm test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `node tests/auth.test.js` - Run comprehensive authentication tests
- `node tests/auth-simple.test.js` - Run basic auth functionality tests
- `node tests/auth-security.test.js` - Run security-focused tests

## Architecture

### Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with NestJS-style decorators and patterns
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with passport strategies
- **Validation**: Zod schemas with middleware
- **File Uploads**: Multer with Sharp for image processing

### Project Structure
- `src/server.ts` - Express application entry point
- `src/routes/` - Route definitions with middleware
- `src/controllers/` - Request handlers and business logic
- `src/middlewares/` - Authentication, validation, and error handling
- `src/schemas/` - Zod validation schemas
- `src/prisma/` - Database client configuration
- `prisma/schema.prisma` - Database schema with User, Partner, Address, Product models

### Key Patterns
- Routes use validation middleware with Zod schemas before controllers
- Authentication middleware (`authenticate`) protects routes requiring login
- Error handling centralized in `error.middleware.ts`
- Database operations use Prisma client with transaction support
- User roles: ADMIN, PARTNER_ADMIN, PARTNER_USER, CUSTOMER

### Environment Setup
Server runs on PORT (default 3001) with CORS configured for FRONTEND_URL (default localhost:3000). Requires DATABASE_URL and DIRECT_URL for Prisma connection.

### Testing Strategy
Uses custom Node.js test files with curl commands for integration testing. Tests cover authentication flows, user roles, security edge cases, and API endpoints. Current auth security coverage needs improvement (52% pass rate on security tests).