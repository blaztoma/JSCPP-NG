const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const runtime=fs.readFileSync(process.env.JSCPP_RUNTIME||path.resolve(__dirname,"../dist/JSCPP.js"),'utf8');
function run(code,input=[]){
 const context=vm.createContext({console,setTimeout,clearTimeout,setImmediate,clearImmediate,performance,document:{}});context.window=context;
 vm.runInContext(runtime,context);let output='',reads=0;
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Execution timed out')),8000);
  const fail=e=>{clearTimeout(timeout);reject(e)};
  try{context.JSCPP.run(code,async()=>{if(reads>=input.length)throw Error('Unexpected input request');return input[reads++];},{printStdin:false,eventLoopSteps:1000,maxTimeout:5000,stopExecutionCheck:()=>false,stdio:{write:s=>{output+=s},promiseError:fail,finishCallback:exit=>{clearTimeout(timeout);resolve({output,exit,reads});}}});}catch(e){fail(e)}
 });
}
const cpp=body=>'#include <iostream>\n#include <string>\n#include <algorithm>\n#include <cctype>\n#include <vector>\nusing namespace std;\n'+body;
test('original chatbot, all branches, priority and substring exit',async()=>{
 const original=fs.readFileSync(path.resolve(__dirname,'fixtures/chatbot.cpp'),'utf8');
 for(const [input,expected]of[
  [['','LABAS','sveiki','vardas','kaip sekasi','pagalba','?','viso'],['Atsiprasau, nesupratau.','Labas!','Labas!','C++ kalba.','Man sekasi gerai.','Gali parasytisveikinima','Atsiprasau, nesupratau.','Iki!']],
  [['matematika'],['Iki!']],
  [['labas, ate'],['Labas!']]
 ]){
  const result=await run(original,input);assert.equal(result.exit,0);assert.equal(result.reads,input.length);
  const replies=result.output.split('Robotas: ').slice(1);assert.equal(replies.length,expected.length);
  expected.forEach((text,i)=>assert.ok(replies[i].includes(text),replies[i]));
 }
});
test('find: char, char pointer, string, const receiver, position, npos',async()=>{
 const result=await run(cpp(`int main(){
 const string text="abc abc"; string needle="abc"; const char* chars="bc";
 cout<<text.find('b')<<" "<<text.find('b',2)<<" "<<text.find("abc")<<" "<<text.find("abc",1)<<" "<<text.find(needle)<<" "<<text.find(needle,1)<<" "<<text.find(chars)<<" "<<text.find(chars,3)<<endl;
 cout<<(text.find("missing")==string::npos)<<" "<<(text.find('x')==string::npos)<<" "<<(text.find("abc",7)==string::npos)<<" "<<(text.find("abc",string::npos)==string::npos)<<endl;
 cout<<text.find("",0)<<" "<<text.find("",7)<<" "<<(text.find("",8)==string::npos)<<endl;
 string empty; cout<<empty.find("")<<" "<<(empty.find("a")==string::npos)<<" "<<(empty.find('a')==string::npos)<<endl;
 return 0;
}`));assert.equal(result.output,'1 5 0 4 0 4 1 5\n1 1 1 1\n0 7 1\n0 1 1\n');
});
test('find: bounded prefix and embedded NUL, byte indices',async()=>{
 const result=await run(cpp(`int main(){
 string text="xxabcyy"; char needle[]={'a','b','c','Z'};
 cout<<text.find(needle,0,3)<<" "<<(text.find(needle,0,4)==string::npos)<<" "<<text.find(needle,7,0)<<endl;
 string binary="axb";binary[1]='\\0';string part="xb";part[0]='\\0';
 cout<<binary.find(part)<<" "<<binary.find("\\0b",0,2)<<" "<<binary.find('\\0')<<endl;
 string utf="ąb";cout<<utf.find("b")<<endl;return 0;
}`));assert.equal(result.output,'2 1 7\n1 1 1\n2\n');
});
test('transform: in-place lowercase and returned output end',async()=>{
 const result=await run(cpp(`int main(){string text="LaBaS 123!";auto end=transform(text.begin(),text.end(),text.begin(),::tolower);cout<<text<<" "<<(end==text.end())<<endl;return 0;}`));
 assert.equal(result.output,'labas 123! 1\n');
});
test('transform: separate output, partial range, function pointer and promotion',async()=>{
 const result=await run(cpp(`int twice(int x){return x*2;} int main(){int a[]={1,2,3,4};int b[]={9,9,9,9};auto fn=&twice;auto end=transform(a+1,a+3,b+1,fn);for(int i=0;i<4;i++)cout<<a[i]<<" ";cout<<endl;for(int i=0;i<4;i++)cout<<b[i]<<" ";cout<<(end==b+3)<<endl;return 0;}`));
 assert.equal(result.output,'1 2 3 4 \n9 4 6 9 1\n');
});
test('transform: binary operation and vector iterators',async()=>{
 const result=await run(cpp(`int add(int a,int b){return a+b;} int main(){vector<int> a={1,2,3};vector<int> b={4,5,6};auto end=transform(a.begin(),a.end(),b.begin(),a.begin(),add);cout<<(end==a.end())<<" ";for(int i=0;i<3;i++)cout<<a[i]<<" ";return 0;}`));
 assert.equal(result.output,'1 5 7 9 ');
});
test('transform: empty range never invokes callback or dereferences end',async()=>{
 const result=await run(cpp(`int fail(int x){cout<<"unexpected";return x;}int main(){int a[]={2};auto end=transform(a,a,a,fail);cout<<(end==a)<<" "<<a[0]<<endl;string empty="";transform(empty.begin(),empty.end(),empty.begin(),::tolower);return 0;}`));assert.equal(result.output,'1 2\n');
});
test('transform: callback can suspend for interactive input',async()=>{
 const result=await run(cpp(`int readAdd(int x){int y;cin>>y;return x+y;}int main(){int a[]={1,2};transform(a,a+2,a,readAdd);cout<<a[0]<<" "<<a[1]<<endl;return 0;}`),['10','20']);assert.equal(result.output,'11 22\n');assert.equal(result.reads,2);
});
test('string return: literal, char pointer, nested calls and numeric returns',async()=>{
 const result=await run(cpp(`string literal(){return "labas";}string pointer(){const char* p="viso";return p;}string nested(){return literal();}double number(){return 3;}int main(){cout<<literal()<<" "<<pointer()<<" "<<nested()<<" "<<number()<<endl;return 0;}`));assert.equal(result.output,'labas viso labas 3\n');
});
test('transform: non-callable argument is rejected',async()=>{
 await assert.rejects(run(cpp('int main(){int a[]={1};transform(a,a+1,a,7);return 0;}')),/No matching function/);
});
test('transform: lambda function object',async()=>{
 const result=await run(cpp('int main(){int a[]={2,4};auto op=[](int x)->int{return x+1;};transform(a,a+2,a,op);cout<<a[0]<<" "<<a[1]<<endl;return 0;}'));assert.equal(result.output,'3 5\n');
});
test('transform: callback error propagates',async()=>{
 await assert.rejects(run(cpp('int bad(int x){return x/0;}int main(){int a[]={2};transform(a,a+1,a,bad);return 0;}')),/zero|division/i);
});
test('literal and char pointer convert to string value and const reference parameters',async()=>{
 const result=await run(cpp('int sizeOf(string s){return s.size();}int constSize(const string& s){return s.size();}int main(){const char* p="abc";cout<<sizeOf("labas")<<" "<<constSize("ate")<<" "<<constSize(p)<<" "<<stoi("12")<<endl;return 0;}'));assert.equal(result.output,'5 3 3 12\n');
});
