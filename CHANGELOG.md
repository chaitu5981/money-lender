# Changelog

All notable changes to Money Lenders Calculator will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2024-12-XX

### Fixed
- Fixed validation to ensure first chronological transaction must always be a borrowal
- Fixed transaction sorting to show borrowals first when multiple transactions occur on the same day
- Fixed interest calculation to correctly combine same-day transactions into net amounts for reporting
- Fixed input validation to only allow digits in borrowal/repayment amounts
- Fixed interest rate input to allow floating point values
- Fixed interest calculation to work correctly with interest rates >= 100%
- Fixed keep-awake error that was appearing in console (harmless but annoying)
- Fixed transaction table display to show individual transactions while report shows combined same-day transactions

### Improved
- Enhanced transaction validation with better error messages
- Improved date handling for same-day transaction aggregation
- Better error handling for edge cases in transaction management

## [1.0.1] - Previous Release

### Added
- Initial release features

## [1.0.0] - Initial Release

### Added
- Interest calculation with configurable rate
- Transaction management (borrowals and repayments)
- PDF export functionality
- Dark mode support
- Data persistence with AsyncStorage
- Transaction validation and sorting

