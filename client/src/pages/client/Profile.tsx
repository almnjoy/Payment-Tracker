import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MOCK_USER } from "@/lib/mockData";
import { User, Mail, Phone, Lock, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ClientProfile() {
  return (
    <Layout role="client">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Profile</h2>
          <p className="text-gray-500">Manage your account settings and preferences.</p>
        </div>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your contact details and public profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Avatar className="h-24 w-24 border-2 border-white shadow-lg">
                <AvatarImage src={MOCK_USER.avatar} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">SM</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                 <Button variant="outline" className="mr-2">Change Avatar</Button>
                 <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50">Remove</Button>
                 <p className="text-xs text-gray-400 mt-2">JPG, GIF or PNG. Max size of 800K</p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input id="name" defaultValue={MOCK_USER.name} className="pl-9 bg-gray-50/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input id="email" defaultValue={MOCK_USER.email} className="pl-9 bg-gray-50/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input id="phone" defaultValue={MOCK_USER.phone} className="pl-9 bg-gray-50/50" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button className="btn-primary-orange">Save Changes</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage your password and account security.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50/50">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-white rounded-md shadow-sm border border-gray-100">
                    <Lock className="h-4 w-4 text-gray-500" />
                 </div>
                 <div>
                   <p className="font-medium text-gray-900">Password</p>
                   <p className="text-sm text-gray-500">Last changed 3 months ago</p>
                 </div>
               </div>
               <Button variant="outline">Reset Password</Button>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50/50">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-white rounded-md shadow-sm border border-gray-100">
                    <Shield className="h-4 w-4 text-gray-500" />
                 </div>
                 <div>
                   <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                   <p className="text-sm text-gray-500">Add an extra layer of security</p>
                 </div>
               </div>
               <Button variant="outline">Enable</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
