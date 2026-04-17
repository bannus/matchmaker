import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export function CourtFlyerPage() {
  const { courtGroupId } = useParams<{ courtGroupId: string }>()
  const { profile } = useAuth()
  const [courtName, setCourtName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const joinUrl = `${window.location.origin}/join?court=${courtGroupId}`

  useEffect(() => {
    if (!courtGroupId) return

    supabase
      .from('court_groups')
      .select('name')
      .eq('id', courtGroupId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError('Court group not found.')
        } else {
          setCourtName(data.name)
        }
        setLoading(false)
      })
  }, [courtGroupId])

  if (!profile?.is_admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Admin access required.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    )
  }

  if (error || !courtName) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link to="/admin/courts" className="text-green-600 underline">
            Back to courts
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Print controls - hidden when printing */}
      <div className="print:hidden sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link
          to="/admin/courts"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to courts
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
        >
          🖨️ Print Flyer
        </button>
      </div>

      {/* Flyer content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-57px)] print:min-h-screen p-8 print:p-0">
        <div className="bg-white rounded-2xl print:rounded-none shadow-lg print:shadow-none border border-gray-200 print:border-0 p-12 max-w-lg w-full text-center">
          {/* Header */}
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🎾 Matchmaker</h1>
          <p className="text-lg text-gray-600 mb-8">
            Find tennis partners in your neighborhood
          </p>

          {/* Court name */}
          <div className="bg-green-50 rounded-xl px-6 py-4 mb-8 border border-green-200">
            <p className="text-sm text-green-700 font-medium uppercase tracking-wide mb-1">
              Your Court
            </p>
            <p className="text-2xl font-bold text-green-800">{courtName}</p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
              <QRCodeSVG
                value={joinUrl}
                size={200}
                level="M"
                marginSize={2}
              />
            </div>
          </div>

          {/* Call to action */}
          <p className="text-lg font-semibold text-gray-900 mb-2">
            Scan to find a hitting partner
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Get matched with players at your skill level — it's free!
          </p>

          {/* Fallback URL */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-400 break-all">{joinUrl}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
