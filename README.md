# Global Bridge

A real-time voice translation and sign language translation application with video chat capabilities that helps connect with people worldwide.


## Features
- Speech Recognition: Uses the built-in browser API (Web Speech) to capture your spoken words.
- Real-Time Translation: Calls a translation service (like Google Translate API) or a local mock translator to convert recognized text.
- Sign Detection: Optional integration with TensorFlow handpose + Mediapipe to detect simple sign language gestures.
- UI Panel: A draggable, resizable panel over your Google Meet window, with toggle buttons for starting/stopping translations.
- Minimize: Collapses to a small icon so it doesn’t obstruct your video call.

## Requirements
-Chrome Browser (ideally version 88 or above), since it relies on Chrome’s built-in SpeechRecognition.
-Microphone Access: The extension asks for mic permission to do speech recognition.

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

 **Infrastructure Security**:
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
