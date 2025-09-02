import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowRight, CheckCircle, Users, FileText, Brain, Smartphone, Download } from "lucide-react";
import { Link } from "wouter";
import heroImage from "@assets/Gemini_Generated_Image_y12y9jy12y9jy12y_1756850005074.png";

export default function HeroLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-bold text-gray-900">
            HouseGuide
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative">
        {/* Background with gradient overlay */}
        <div 
          className="min-h-[80vh] bg-cover bg-center bg-no-repeat relative flex items-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 via-blue-500/60 to-teal-400/40"></div>
          
          {/* Hero Content */}
          <div className="relative z-10 w-full px-6">
            <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
              
              {/* Left Content */}
              <div className="space-y-8 text-white">
                <div className="space-y-4">
                  <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                    HouseGuide —
                    <br />
                    <span className="text-teal-200">Manage Members.</span>
                    <br />
                    <span className="text-blue-200">Stay Compliant.</span>
                  </h1>
                  
                  <p className="text-2xl md:text-3xl font-light text-blue-100">
                    Simple. Secure. Sober Living.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-base px-4 py-2">
                    <Shield className="w-4 h-4 mr-2" />
                    HIPAA Ready
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-base px-4 py-2">
                    <Smartphone className="w-4 h-4 mr-2" />
                    Mobile First
                  </Badge>
                </div>

                {/* Primary CTA */}
                <div className="space-y-4">
                  <Link href="/register">
                    <Button 
                      size="lg" 
                      className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg group shadow-xl"
                      data-testid="button-signup-hero"
                    >
                      Start Free Trial
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <p className="text-blue-100 text-sm">
                      No credit card required • 30-day free trial
                    </p>
                    <a 
                      href="/HIPAA_Compliance_Binder_1756850255321.zip" 
                      download
                      className="flex items-center space-x-2 text-blue-200 hover:text-white transition-colors text-sm group"
                    >
                      <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                      <span>Download Compliance Binder</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Right side - Let the background image show through */}
              <div className="hidden lg:block">
                {/* This space allows the mobile mockup to show */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-gray-900">
              Everything You Need for Sober Living Management
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              AI-powered document processing, comprehensive member tracking, and automated compliance reporting 
              designed specifically for residential care facilities.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4 p-8 bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 shadow-sm">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">AI Document Processing</h3>
              <p className="text-gray-600">
                Scan and automatically classify documents as commitments or write-ups using advanced OCR and AI technology.
              </p>
            </div>

            <div className="text-center space-y-4 p-8 bg-gradient-to-br from-teal-50 to-white rounded-xl border border-teal-100 shadow-sm">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Member Management</h3>
              <p className="text-gray-600">
                Complete tracking for goals, chores, incidents, meetings, fees, and accomplishments with real-time status updates.
              </p>
            </div>

            <div className="text-center space-y-4 p-8 bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-100 shadow-sm">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Compliance Reports</h3>
              <p className="text-gray-600">
                Generate professional weekly reports automatically with AI-powered insights and compliance tracking.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Compliance Section */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-8 mb-12">
            <h2 className="text-4xl font-bold text-gray-900">
              Built for Compliance & Security
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Enterprise-grade security and compliance features designed specifically for healthcare and residential care environments.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center space-y-3 p-6 bg-white rounded-xl shadow-sm">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
              <h4 className="font-semibold text-gray-900">HIPAA Compliant</h4>
              <p className="text-sm text-gray-600">Full healthcare data protection standards</p>
            </div>
            
            <div className="text-center space-y-3 p-6 bg-white rounded-xl shadow-sm">
              <Shield className="w-12 h-12 text-blue-600 mx-auto" />
              <h4 className="font-semibold text-gray-900">SOC-2 Ready</h4>
              <p className="text-sm text-gray-600">Enterprise compliance documentation</p>
            </div>
            
            <div className="text-center space-y-3 p-6 bg-white rounded-xl shadow-sm">
              <Smartphone className="w-12 h-12 text-teal-600 mx-auto" />
              <h4 className="font-semibold text-gray-900">Mobile-First PWA</h4>
              <p className="text-sm text-gray-600">Works offline, installs like a native app</p>
            </div>
            
            <div className="text-center space-y-3 p-6 bg-white rounded-xl shadow-sm">
              <Brain className="w-12 h-12 text-purple-600 mx-auto" />
              <h4 className="font-semibold text-gray-900">AI-Powered</h4>
              <p className="text-sm text-gray-600">Automated document classification and reporting</p>
            </div>
          </div>

          {/* Secondary CTA */}
          <div className="text-center mt-12">
            <Link href="/register">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white px-8 py-4 text-lg font-semibold shadow-lg"
                data-testid="button-signup-secondary"
              >
                Get Started Today
              </Button>
            </Link>
            <p className="text-gray-600 mt-4">
              Join hundreds of sober living facilities already using HouseGuide
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center space-x-2">
              <h3 className="text-2xl font-bold text-gray-900">HouseGuide</h3>
            </div>
            
            <p className="text-gray-600 max-w-2xl mx-auto">
              Empowering sober living facilities with AI-powered management solutions. 
              Simple, secure, and compliant tools for better member care.
            </p>
            
            {/* Legal Compliance Line */}
            <div className="pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                HouseGuide is HIPAA-ready and compliant with 45 CFR Parts 160 & 164.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}