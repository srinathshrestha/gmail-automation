// Privacy policy page
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export default function PrivacyPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Icon name="Shield" className="h-6 w-6 sm:h-8 sm:w-8" size={32} />
          Privacy Policy
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          How we handle your data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Database" size={20} />
            What Data We Store
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            InboxJanitor stores only lightweight metadata about your emails. We
            never store:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Email body content</li>
            <li>Attachments</li>
            <li>Full email text</li>
          </ul>
          <p>We do store:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              Email metadata: sender, subject, snippet (first few words), date
            </li>
            <li>Gmail labels and categories</li>
            <li>Whether you replied to emails</li>
            <li>AI classification results (category, delete score, reason)</li>
            <li>Your deletion decisions (for learning)</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Lock" size={20} />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We take security seriously:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>All refresh tokens are encrypted at rest using AES-256-GCM</li>
            <li>Access tokens are cached temporarily and encrypted</li>
            <li>We use secure OAuth 2.0 flows for authentication</li>
            <li>All database connections use SSL/TLS</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Trash" size={20} />
            Data Deletion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            You can delete all your data at any time. This will permanently
            remove:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>All synced email metadata</li>
            <li>Your account information</li>
            <li>All learning data and statistics</li>
            <li>All deletion history</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Note: This action cannot be undone. Your Gmail account will not be
            affected - we only delete data stored in our database.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Why We Store This Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We store email metadata to:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Provide analytics and insights about your inbox</li>
            <li>Suggest emails for deletion using AI</li>
            <li>Learn from your decisions to improve suggestions</li>
            <li>Track deletion history for your reference</li>
          </ul>
          <p>
            We never sell or share your data with third parties. Your data is
            used solely to provide the InboxJanitor service.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            If you have questions about this privacy policy or how we handle
            your data, please contact us through the app settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
