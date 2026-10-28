# Optional update notifications

Computer Monitor Dashbaord does not silently download or install updates.

A future release may add an opt-in notification that:

1. Checks the repository’s public GitHub Releases API at user-selected
   intervals.
2. Compares the latest semantic version with the installed version.
3. Displays release notes and an explicit **Open download page** action.
4. Never downloads or installs software without the user’s confirmation.
5. Can be disabled completely and handles offline use without warnings.

The GitHub repository owner and release URL must be known before this feature is
implemented. The application currently makes no network requests and remains
fully local.
