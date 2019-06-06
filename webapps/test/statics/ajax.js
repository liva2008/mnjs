/**
 * jwebAjax is a simple interface function for Ajax programming.
 * The function has four arguments which are 
 * url, params, onSuccess, method.
 * url: the submit address 
 * params: the submit data, as k1=v1&k2=v2&...&kn=vn
 * onSuccess: the callback function of success request
 * method: the request method which has GET and POST, default is POST
 */
function jwebAjax(url, params, onSuccess, method){
    var xmlHttp;
    
    // Creating the XMLHttpRequest Object
    if(window.ActiveXObject){
        try{
            xmlHttp = new ActiveXObject("Msxml2.XMLHTTP");
        }
        catch(e){
            xmlHttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
    }
    else if(window.XMLHttpRequest){
        xmlHttp = new XMLHttpRequest();
    }
    
    // Setting the callback function
    xmlHttp.onreadystatechange = function(){
        if(xmlHttp.readyState == 4) 
        { 
            onSuccess(xmlHttp); 
        }  
    }
    
    // Default method is POST
    var method = method || "POST";
        
    if(method.toUpperCase() == "GET"){
        url = url+"?"+params;
        xmlHttp.open("GET",url,true);
        xmlHttp.send(null);
    }
    else{
        xmlHttp.open("POST",url,true);
        xmlHttp.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
        xmlHttp.send(params);
    }
} 