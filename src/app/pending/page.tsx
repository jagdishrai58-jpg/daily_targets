export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-center">
      <div className="max-w-sm">
        <h1 className="text-3xl font-black mb-4">Pending Activation</h1>
        <p className="text-slate-600 mb-6">Please complete your payment. Once confirmed by the admin, your account will be activated.</p>
        <div className="bg-slate-100 p-4 rounded-lg font-mono text-sm">UPI: camaster@upi</div>
      </div>
    </div>
  )
}