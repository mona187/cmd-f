# Sign Language Translator

A real-time sign language translation application with video chat capabilities.

## DevSecOps Features

### Security Measures
- **Pre-commit Hooks**: Automated checks for:
  - Code linting
  - Unit tests
  - Secret scanning
  - Security vulnerabilities
- **GitHub Security**:
  - Branch protection rules
  - Automated dependency updates (Dependabot)
  - Secret scanning
  - Code scanning with ESLint security rules

### CI/CD Pipeline
- **Automated Testing**:
  - Unit tests with Jest
  - Code coverage reports (minimum 80% coverage required)
  - Security scanning
- **Build Process**:
  - Automated builds on push/PR
  - Artifact storage
- **Deployment**:
  - Automated deployment to production for main branch
  - Environment-based secret management

### Quality Assurance
- ESLint with security rules
- Prettier for code formatting
- TypeScript for type safety
- Husky for git hooks
- Lint-staged for incremental linting

## Security Best Practices
1. **Secret Management**:
   - No hardcoded secrets
   - Environment-based configuration
   - Secret scanning in CI/CD

2. **Code Security**:
   - Regular dependency updates
   - Security-focused linting rules
   - Input validation
   - XSS prevention
   - CSRF protection

3. **Infrastructure Security**:
   - HTTPS enforcement
   - Secure WebRTC configuration
   - Rate limiting
   - Error handling

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Set up pre-commit hooks:
```bash
npm run prepare
```

3. Start development server:
```bash
npm start
```

4. Run tests:
```bash
npm test
```

5. Run security checks:
```bash
npm run security-audit
npm run scan-secrets
```

## Contributing

1. Create a new branch
2. Make changes
3. Ensure all checks pass:
   - Tests
   - Linting
   - Security scans
4. Submit a pull request

## Environment Variables

Required environment variables:
- `REACT_APP_SIGNAL_SERVER_URL`: WebRTC signaling server URL
- `REACT_APP_API_KEY`: API key for translation service (if applicable)

## License

MIT
