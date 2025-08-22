import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const ConfirmationPage: React.FC = () => {
  const { userProfile, signOut } = useAuth();
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrderDetails = useCallback(async () => {
    if (!userProfile) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('date_submitted', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching order details:', error);
        return;
      }

      setOrderDetails(data);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-alteryx-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading confirmation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-alteryx-light-blue py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-alteryx-blue to-alteryx-dark-blue px-8 py-6">
            <div className="flex items-center justify-center">
              <div className="bg-white rounded-full p-3 mr-4">
                <svg className="h-8 w-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Order Confirmed!</h1>
                <p className="text-alteryx-light-blue">Thank you for your order</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Your order has been successfully placed
              </h2>
              <p className="text-gray-600">
                We'll ship your Alteryx swag to your registered address within 5-7 business days.
              </p>
            </div>

            {/* Order Details */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Order ID:</span>
                  <span className="font-medium">{orderDetails?.id || 'N/A'}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Order Date:</span>
                  <span className="font-medium">
                    {orderDetails?.date_submitted 
                      ? new Date(orderDetails.date_submitted).toLocaleDateString()
                      : 'N/A'
                    }
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium">{userProfile?.full_name || 'N/A'}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{userProfile?.email || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h3>
              
              {userProfile?.shipping_address && (
                <div className="text-gray-600">
                  <p>{userProfile.shipping_address.address_line_1}</p>
                  {userProfile.shipping_address.address_line_2 && (
                    <p>{userProfile.shipping_address.address_line_2}</p>
                  )}
                  <p>
                    {userProfile.shipping_address.city}, {userProfile.shipping_address.state} {userProfile.shipping_address.zip_code}
                  </p>
                  <p>{userProfile.shipping_address.country}</p>
                </div>
              )}
            </div>

            {/* Next Steps */}
            <div className="bg-alteryx-light-blue rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-alteryx-dark-blue mb-4">What's Next?</h3>
              <ul className="space-y-2 text-alteryx-dark-blue">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  You'll receive a confirmation email shortly
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Your order will be processed within 24 hours
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Shipping typically takes 5-7 business days
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  You'll receive tracking information via email
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleSignOut}
                className="btn-secondary flex-1"
              >
                Sign Out
              </button>
              
              <button
                onClick={() => window.print()}
                className="btn-primary flex-1"
              >
                Print Confirmation
              </button>
            </div>

            <div className="text-center mt-6">
              <p className="text-sm text-gray-500">
                Questions? Contact <span className="text-alteryx-blue">swag@alteryx.com</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationPage;




