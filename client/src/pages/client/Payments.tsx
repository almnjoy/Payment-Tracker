import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_PAYMENTS } from "@/lib/mockData";
import { Download, CheckCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function ClientPayments() {
  return (
    <Layout role="client">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Payments</h2>
            <p className="text-gray-500">View your payment history and current invoices.</p>
          </div>
          <Button className="btn-primary-orange">
             Make a Payment
          </Button>
        </div>

        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {MOCK_PAYMENTS.map((payment, index) => (
                <motion.div 
                  key={payment.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{payment.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(payment.date).toLocaleDateString()} • ID: {payment.id}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <span className="font-bold text-gray-900">${payment.amount.toFixed(2)}</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                      Paid
                    </Badge>
                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-900">
                      <Download size={18} />
                    </Button>
                  </div>
                </motion.div>
              ))}
              
              {/* Fake pending item for visuals */}
              <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">January Rent (Upcoming)</p>
                      <p className="text-sm text-gray-500">
                        Due Jan 15, 2026 • ID: INV-2025-001
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <span className="font-bold text-gray-900">$1,250.00</span>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">
                      Pending
                    </Badge>
                    <Button className="h-8 btn-primary-orange text-xs px-3 py-0">
                      Pay Now
                    </Button>
                  </div>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
